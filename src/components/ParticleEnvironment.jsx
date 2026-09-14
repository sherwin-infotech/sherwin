import React, { useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { interactionSystem } from '../systems/InteractionSystem';
import { PALETTE, PARTICLE_CONFIG, ORB_CONFIG } from '../constants';

const MAX_UNIFORM_WAVES = 4;

// GLSL Vertex Shader for Subtle Supporting Cavern Particles
const particleVertexShader = `
  uniform float uTime;
  uniform float uPixelRatio;
  
  uniform vec4 uWave0; // xyz = origin, w = age
  uniform vec4 uWave1;
  uniform vec4 uWave2;
  uniform vec4 uWave3;
  uniform vec4 uWaveParams; // x = speed, y = maxRadius, z = duration, w = activeCount

  attribute float aSize;
  attribute float aPhase;
  attribute float aAccent;       // 0.0 = Cyan, 1.0 = Highlight, 2.0 = Violet
  attribute float aReflectivity;
  attribute float aJitter;
  attribute float aDepthLayer;
  attribute float aCategory;     // 0.0 = Dust, 1.0 = Measurement Spark, 2.0 = Bio Wake, 3.0 = Seed Energy

  varying float vWaveIntensity;
  varying float vDepth;
  varying float vAccent;
  varying float vCategory;

  float calcAcousticEcho(vec4 wave, vec3 pos, float jitter, float reflectivity) {
    float waveAge = wave.w;
    if (waveAge <= 0.0 || waveAge > uWaveParams.z) return 0.0;
    float d = distance(pos, wave.xyz);
    float maxRadius = uWaveParams.y;
    if (d > maxRadius) return 0.0;

    float arrivalTime = d / uWaveParams.x;
    float localAge = waveAge - arrivalTime + jitter;
    if (localAge < 0.0) return 0.0;

    float onset = smoothstep(0.0, 0.07, localAge);
    float decay = exp(-1.45 * localAge);
    float distAtten = pow(clamp(1.0 - d / maxRadius, 0.0, 1.0), 2.0);
    return onset * decay * distAtten * reflectivity * 2.8;
  }

  void main() {
    vAccent = aAccent;
    vCategory = aCategory;
    vec3 basePos = position;

    // Gentle subterranean Brownian drift for dust and wake
    float t = uTime * 0.18 + aPhase;
    if (aCategory < 0.5) {
      basePos.x += sin(t * 0.45) * 0.14;
      basePos.y += cos(t * 0.40) * 0.14;
      basePos.z += sin(t * 0.30) * 0.10;
    } else if (aCategory > 1.5 && aCategory < 2.5) {
      basePos.x += sin(t * 1.1) * 0.08;
      basePos.y += cos(t * 0.9) * 0.08;
    }

    float e0 = uWaveParams.w > 0.5 ? calcAcousticEcho(uWave0, basePos, aJitter, aReflectivity) : 0.0;
    float e1 = uWaveParams.w > 1.5 ? calcAcousticEcho(uWave1, basePos, aJitter, aReflectivity) : 0.0;
    float e2 = uWaveParams.w > 2.5 ? calcAcousticEcho(uWave2, basePos, aJitter, aReflectivity) : 0.0;
    float e3 = uWaveParams.w > 3.5 ? calcAcousticEcho(uWave3, basePos, aJitter, aReflectivity) : 0.0;

    vWaveIntensity = clamp(e0 + e1 + e2 + e3, 0.0, 3.0);

    vec4 mvPosition = modelViewMatrix * vec4(basePos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    vDepth = -mvPosition.z;

    float dynamicSize = aSize * (0.9 + vWaveIntensity * 0.45);
    gl_PointSize = dynamicSize * uPixelRatio * (22.0 / max(vDepth, 4.0));
  }
`;

// GLSL Fragment Shader for Subtle Supporting Particles
const particleFragmentShader = `
  uniform vec3 uBaseColor;
  uniform vec3 uActiveColor;
  uniform vec3 uHighlightColor;
  uniform vec3 uVioletColor;

  varying float vWaveIntensity;
  varying float vDepth;
  varying float vAccent;
  varying float vCategory;

  void main() {
    // Measurement sparks (Cat 1) & Bio Wake (Cat 2) are completely dark at rest
    if (vCategory > 0.5 && vCategory < 2.5) {
      if (vWaveIntensity < 0.001) discard;
    }

    vec2 coord = gl_PointCoord - vec2(0.5);
    float dist = length(coord);
    if (dist > 0.5) discard;

    float alpha = smoothstep(0.5, 0.25, dist);

    vec3 color = uActiveColor;
    if (vAccent > 1.5) {
      color = uVioletColor;
    } else if (vAccent > 0.5) {
      color = uHighlightColor;
    }

    vec3 finalColor = mix(uBaseColor, color, smoothstep(0.01, 0.35, vWaveIntensity));

    // Atmospheric dust (Cat 0): very faint resting alpha (~0.032)
    // Seed energy (Cat 3): subtle resting alpha (~0.020)
    float restingAlpha = 0.0;
    if (vCategory < 0.5) {
      restingAlpha = 0.032;
    } else if (vCategory > 2.5) {
      restingAlpha = 0.020;
    }

    float litAlpha = 0.85;
    float waveFactor = smoothstep(0.005, 0.40, vWaveIntensity);
    float finalAlpha = mix(restingAlpha, litAlpha, waveFactor) * alpha;

    // Distance depth fade
    finalAlpha *= (1.0 - smoothstep(16.0, 42.0, vDepth));
    if (finalAlpha < 0.002) discard;

    gl_FragColor = vec4(finalColor, finalAlpha);
  }
`;

export default function ParticleEnvironment({ performanceTier = 'HIGH' }) {
  const pointsRef = useRef();
  const materialRef = useRef();
  const { gl } = useThree();

  const particleCount = useMemo(() => {
    if (performanceTier === 'LOW') return PARTICLE_CONFIG.totalCountMobile;
    if (performanceTier === 'MEDIUM') return PARTICLE_CONFIG.totalCountMedium;
    return PARTICLE_CONFIG.totalCountDesktop;
  }, [performanceTier]);

  const pointData = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const sz = new Float32Array(particleCount);
    const ph = new Float32Array(particleCount);
    const acc = new Float32Array(particleCount);
    const ref = new Float32Array(particleCount);
    const jit = new Float32Array(particleCount);
    const dep = new Float32Array(particleCount);
    const cat = new Float32Array(particleCount);

    const dustCount = Math.round(particleCount * 0.36); // ~50 dust
    const sparkCount = Math.round(particleCount * 0.30); // ~42 sparks
    const bioCount = Math.round(particleCount * 0.18); // ~25 bio wake
    const seedCount = particleCount - dustCount - sparkCount - bioCount; // ~23 seed energy

    let pIdx = 0;

    // 1. ATMOSPHERIC CAVERN DUST (Brownian drift, faint presence)
    for (let i = 0; i < dustCount; i++) {
      pos[pIdx * 3 + 0] = (Math.random() - 0.5) * 22;
      pos[pIdx * 3 + 1] = -4.0 + Math.random() * 8.5;
      pos[pIdx * 3 + 2] = -0.5 - Math.random() * 6.5;

      sz[pIdx] = 0.6 + Math.random() * 0.7;
      ph[pIdx] = Math.random() * Math.PI * 2;
      acc[pIdx] = 0.0;
      ref[pIdx] = 0.25 + Math.random() * 0.35;
      jit[pIdx] = (Math.random() - 0.5) * 0.16;
      dep[pIdx] = 1.0;
      cat[pIdx] = 0.0;
      pIdx++;
    }

    // 2. ACOUSTIC MEASUREMENT SPARKS (Brief subtle coordinate twinkles upon sound arrival)
    for (let i = 0; i < sparkCount; i++) {
      pos[pIdx * 3 + 0] = (Math.random() - 0.5) * 20;
      pos[pIdx * 3 + 1] = -4.5 + Math.random() * 9.0;
      pos[pIdx * 3 + 2] = -2.0 - Math.random() * 5.0;

      sz[pIdx] = 0.75 + Math.random() * 0.85;
      ph[pIdx] = Math.random() * Math.PI * 2;
      acc[pIdx] = Math.random() < 0.7 ? 0.0 : 1.0;
      ref[pIdx] = 0.50 + Math.random() * 0.50;
      jit[pIdx] = (Math.random() - 0.5) * 0.12;
      dep[pIdx] = 1.0;
      cat[pIdx] = 1.0;
      pIdx++;
    }

    // 3. BIOLOGICAL WAKE PARTICLES (Near upper flight corridors)
    for (let i = 0; i < bioCount; i++) {
      const side = Math.random() < 0.5 ? -1 : 1;
      pos[pIdx * 3 + 0] = side * (3.0 + Math.random() * 7.5);
      pos[pIdx * 3 + 1] = 0.5 + Math.random() * 4.5;
      pos[pIdx * 3 + 2] = -2.5 - Math.random() * 4.5;

      sz[pIdx] = 0.7 + Math.random() * 0.8;
      ph[pIdx] = Math.random() * Math.PI * 2;
      acc[pIdx] = 2.0; // Violet
      ref[pIdx] = 0.40 + Math.random() * 0.60;
      jit[pIdx] = (Math.random() - 0.5) * 0.10;
      dep[pIdx] = 1.0;
      cat[pIdx] = 2.0;
      pIdx++;
    }

    // 4. SONAR SEED ENERGY PARTICLES (Around seed origin)
    const seedPos = ORB_CONFIG.initialPosition;
    for (let i = 0; i < seedCount; i++) {
      const theta = Math.random() * Math.PI * 2;
      const r = 0.3 + Math.random() * 1.4;
      pos[pIdx * 3 + 0] = seedPos[0] + Math.cos(theta) * r;
      pos[pIdx * 3 + 1] = seedPos[1] + Math.sin(theta) * r;
      pos[pIdx * 3 + 2] = seedPos[2] + (Math.random() - 0.5) * 0.6;

      sz[pIdx] = 0.65 + Math.random() * 0.75;
      ph[pIdx] = Math.random() * Math.PI * 2;
      acc[pIdx] = 1.0; // Highlight
      ref[pIdx] = 0.80 + Math.random() * 0.20;
      jit[pIdx] = (Math.random() - 0.5) * 0.08;
      dep[pIdx] = 0.0;
      cat[pIdx] = 3.0;
      pIdx++;
    }

    return {
      positions: pos,
      sizes: sz,
      phases: ph,
      accents: acc,
      reflectivities: ref,
      jitters: jit,
      depths: dep,
      categories: cat,
    };
  }, [particleCount]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uPixelRatio: { value: gl.getPixelRatio() },
    uWave0: { value: new THREE.Vector4(0, 0, 0, -1) },
    uWave1: { value: new THREE.Vector4(0, 0, 0, -1) },
    uWave2: { value: new THREE.Vector4(0, 0, 0, -1) },
    uWave3: { value: new THREE.Vector4(0, 0, 0, -1) },
    uWaveParams: { value: new THREE.Vector4(12.5, 9.0, 2.2, 0) },
    uBaseColor: { value: new THREE.Color(PALETTE.depth) },
    uActiveColor: { value: new THREE.Color(PALETTE.cyan) },
    uHighlightColor: { value: new THREE.Color(PALETTE.highlight) },
    uVioletColor: { value: new THREE.Color(PALETTE.violet) },
  }), [gl]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uPixelRatio.value = gl.getPixelRatio();

    const active = interactionSystem.activeWaves.slice(-MAX_UNIFORM_WAVES);
    const uWaves = [
      materialRef.current.uniforms.uWave0.value,
      materialRef.current.uniforms.uWave1.value,
      materialRef.current.uniforms.uWave2.value,
      materialRef.current.uniforms.uWave3.value,
    ];

    for (let i = 0; i < 4; i++) {
      if (i < active.length) {
        const wave = active[i];
        uWaves[i].set(wave.origin.x, wave.origin.y, wave.origin.z, wave.age);
      } else {
        uWaves[i].set(0, 0, 0, -1.0);
      }
    }
    materialRef.current.uniforms.uWaveParams.value.w = active.length;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={pointData.positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-aSize"
          count={particleCount}
          array={pointData.sizes}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aPhase"
          count={particleCount}
          array={pointData.phases}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aAccent"
          count={particleCount}
          array={pointData.accents}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aReflectivity"
          count={particleCount}
          array={pointData.reflectivities}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aJitter"
          count={particleCount}
          array={pointData.jitters}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aDepthLayer"
          count={particleCount}
          array={pointData.depths}
          itemSize={1}
        />
        <bufferAttribute
          attach="attributes-aCategory"
          count={particleCount}
          array={pointData.categories}
          itemSize={1}
        />
      </bufferGeometry>
      <shaderMaterial
        ref={materialRef}
        vertexShader={particleVertexShader}
        fragmentShader={particleFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
