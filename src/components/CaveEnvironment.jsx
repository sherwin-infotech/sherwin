import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { interactionSystem } from '../systems/InteractionSystem';
import { PALETTE } from '../constants';

const MAX_FRAGMENTS = 24;

// Classic 2D Simplex Noise by Stefan Gustavson
const simplexNoiseGLSL = `
vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }

float snoise(vec2 v){
  const vec4 C = vec4(0.211324865405187, 0.366025403784439,
           -0.577350269189626, 0.024390243902439);
  vec2 i  = floor(v + dot(v, C.yy) );
  vec2 x0 = v -   i + dot(i, C.xx);
  vec2 i1;
  i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
  vec4 x12 = x0.xyxy + C.xxzz;
  x12.xy -= i1;
  i = mod(i, 289.0);
  vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 ))
  + i.x + vec3(0.0, i1.x, 1.0 ));
  vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy),
    dot(x12.zw,x12.zw)), 0.0);
  m = m*m ;
  m = m*m ;
  vec3 x = 2.0 * fract(p * C.www) - 1.0;
  vec3 h = abs(x) - 0.5;
  vec3 ox = floor(x + 0.5);
  vec3 a0 = x - ox;
  m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
  vec3 g;
  g.x  = a0.x  * x0.x  + h.x  * x0.y;
  g.yz = a0.yz * x12.xz + h.yz * x12.yw;
  return 130.0 * dot(m, g);
}
`;

const caveVertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
  }
`;

const caveFragmentShader = `
  uniform sampler2D uTexture;
  uniform float uTime;
  uniform float uBaseOpacity;
  uniform float uThunderIntensity;
  uniform vec2 uScreenSize;
  uniform vec2 uImageSize;

  uniform int uFragCount;
  uniform vec4 uFragDataA[${MAX_FRAGMENTS}]; // xy = uvCenter, z = radius, w = targetOpacity
  uniform vec4 uFragDataB[${MAX_FRAGMENTS}]; // x = startTime, y = riseTime, z = peakTime, w = decayTime
  uniform vec4 uFragDataC[${MAX_FRAGMENTS}]; // x = noiseScale, y = eccentricity, z = angle, w = depthBias

  varying vec2 vUv;

  ${simplexNoiseGLSL}

  // Responsive cover UV calculation
  vec2 getCoverUV(vec2 uv, vec2 screen, vec2 img) {
    float sAspect = screen.x / screen.y;
    float iAspect = img.x / img.y;
    vec2 st = uv - 0.5;
    if (sAspect > iAspect) {
      st.y *= iAspect / sAspect;
    } else {
      st.x *= sAspect / iAspect;
    }
    return st + 0.5;
  }

  void main() {
    vec2 coverUV = getCoverUV(vUv, uScreenSize, uImageSize);

    // Guard against outside bounds if aspect ratio changes
    if (coverUV.x < 0.0 || coverUV.x > 1.0 || coverUV.y < 0.0 || coverUV.y > 1.0) {
      gl_FragColor = vec4(0.008, 0.015, 0.02, 1.0);
      return;
    }

    vec4 texColor = texture2D(uTexture, coverUV);

    // Natural rock luminance
    float lum = dot(texColor.rgb, vec3(0.299, 0.587, 0.114));

    // Acoustic Reveal Fragment Accumulation
    // Never a flashlight, never a circle: 8-24 irregular, organic soft openings
    float revealAlpha = 0.0;

    for (int i = 0; i < ${MAX_FRAGMENTS}; i++) {
      if (i >= uFragCount) break;

      vec4 fDataA = uFragDataA[i];
      vec4 fDataB = uFragDataB[i];
      vec4 fDataC = uFragDataC[i];

      float age = uTime - fDataB.x;
      if (age <= 0.0 || age >= fDataB.w) continue;

      // Asymmetric organic temporal envelope (rise -> brief hold -> smooth decay)
      float env = 0.0;
      if (age < fDataB.y) {
        env = smoothstep(0.0, fDataB.y, age);
      } else if (age < fDataB.z) {
        env = 1.0;
      } else {
        env = smoothstep(fDataB.w, fDataB.z, age);
      }

      // Offset from fragment center in vUv space with aspect ratio compensation
      vec2 offset = vUv - fDataA.xy;
      offset.x *= (uScreenSize.x / uScreenSize.y);

      // Elongate and orient along natural geological axes (stalactites, ledges, fissures)
      float cosA = cos(fDataC.z);
      float sinA = sin(fDataC.z);
      vec2 rotOffset = vec2(offset.x * cosA - offset.y * sinA, offset.x * sinA + offset.y * cosA);
      rotOffset.y *= fDataC.y;
      float dist = length(rotOffset);

      // Multi-octave organic simplex noise boundary
      float n1 = snoise(vUv * fDataC.x + vec2(float(i) * 2.37, float(i) * 1.63));
      float n2 = snoise(vUv * (fDataC.x * 2.4) + vec2(float(i) * 4.19, 2.71)) * 0.42;
      float organicNoise = (n1 + n2) * 0.38;

      float effectiveRadius = fDataA.z * (1.0 + organicNoise);

      // Soft feathered edge
      float shape = smoothstep(effectiveRadius, effectiveRadius * 0.28, dist);

      // Surface-alignment: rock facets and stalactite edges catch sound more readily
      float rockAffinity = 0.70 + 0.30 * smoothstep(0.04, 0.36, lum);
      float fragAlpha = shape * env * fDataA.w * rockAffinity;

      revealAlpha = max(revealAlpha, fragAlpha);
    }

    // Thunder illumination: sharp cool electric flash revealing photorealistic cave
    float thunderIllum = uThunderIntensity * (0.35 + 0.65 * lum);
    vec3 lightningTint = vec3(0.90, 0.96, 1.18);
    vec3 illuminatedRock = mix(
      texColor.rgb,
      texColor.rgb * lightningTint * 2.2 + vec3(0.04, 0.07, 0.12) * uThunderIntensity,
      clamp(uThunderIntensity * 0.85, 0.0, 1.0)
    );

    // Subterranean darkness in idle state: uBaseOpacity is ~0.025 (97.5% pitch black)
    // Acoustic event opens fragments; thunder momentarily illuminates the cavern
    float finalAlpha = clamp(uBaseOpacity + revealAlpha + thunderIllum * 0.82, 0.0, 0.96);

    // Subtle acoustic tonal shift: faint cool bioluminescent cyan/highlight on active returns
    vec3 acousticTint = mix(illuminatedRock, illuminatedRock * vec3(1.05, 1.15, 1.25) + vec3(0.0, 0.015, 0.03), smoothstep(0.05, 0.40, revealAlpha));

    gl_FragColor = vec4(acousticTint, finalAlpha);
  }
`;

export default function CaveEnvironment() {
  const meshRef = useRef();
  const materialRef = useRef();
  const { size, viewport, camera } = useThree();

  // Load Cave.png texture
  const texture = useMemo(() => {
    const loader = new THREE.TextureLoader();
    // Use /Cave.png from public, fall back gracefully
    const tex = loader.load(`${import.meta.env.BASE_URL}Cave.png`);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, []);

  // Fragment state arrays for up to MAX_FRAGMENTS
  const fragDataA = useMemo(() => new Float32Array(MAX_FRAGMENTS * 4), []);
  const fragDataB = useMemo(() => new Float32Array(MAX_FRAGMENTS * 4), []);
  const fragDataC = useMemo(() => new Float32Array(MAX_FRAGMENTS * 4), []);
  const fragCountRef = useRef(0);
  const thunderStartTimeRef = useRef(-100);

  const uniforms = useMemo(() => ({
    uTexture: { value: texture },
    uTime: { value: 0 },
    uBaseOpacity: { value: 0.025 }, // 95%+ darkness at rest
    uThunderIntensity: { value: 0.0 },
    uScreenSize: { value: new THREE.Vector2(size.width, size.height) },
    uImageSize: { value: new THREE.Vector2(1672, 941) },
    uFragCount: { value: 0 },
    uFragDataA: { value: fragDataA },
    uFragDataB: { value: fragDataB },
    uFragDataC: { value: fragDataC },
  }), [texture, fragDataA, fragDataB, fragDataC]);

  // Plane positioned at z = -8.5, behind bats (z in [-6, -1]) and seed
  const planeDistance = camera.position.z - (-8.5); // 15 - (-8.5) = 23.5
  const planeHeight = 2.0 * planeDistance * Math.tan(THREE.MathUtils.degToRad(camera.fov * 0.5));
  const planeWidth = planeHeight * (size.width / size.height);

  // Subscribe to acoustic events to generate 14-20 organic reveal fragments
  useEffect(() => {
    const unsubscribe = interactionSystem.subscribe((event, data) => {
      if (event === 'echolocation_impact') {
        const { origin, time } = data;

        // Map 3D impact coordinate (x, y) to normalized UV space on the cave plane
        const normX = (origin.x / (planeWidth * 0.5)) * 0.5 + 0.5;
        const normY = (origin.y / (planeHeight * 0.5)) * 0.5 + 0.5;
        const clampedU = Math.max(0.12, Math.min(0.88, normX));
        const clampedV = Math.max(0.12, Math.min(0.88, normY));

        // Number of organic reveal fragments (14–18 meaningful environmental fragments)
        const count = 14 + Math.floor(Math.random() * 5);
        fragCountRef.current = count;

        for (let i = 0; i < count; i++) {
          let u, v, radius, targetOpacity, birthDelay, riseTime, peakTime, decayTime;
          let eccentricity, angle, noiseScale;

          if (i < 4) {
            // IMMEDIATE LOCAL ROCK FRAGMENTS (near seed impact, very fast response)
            const ang = (i / 4) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
            const dist = 0.03 + Math.random() * 0.06;
            u = clampedU + Math.cos(ang) * dist;
            v = clampedV + Math.sin(ang) * dist;
            radius = 0.10 + Math.random() * 0.05;
            targetOpacity = 0.52 + Math.random() * 0.24; // 0.52 - 0.76 clear perception
            birthDelay = 0.02 + Math.random() * 0.05;     // ~50ms
            riseTime = 0.10;
            peakTime = 0.38 + Math.random() * 0.15;       // ~450ms
            decayTime = 0.90 + Math.random() * 0.25;      // ~1000ms
            eccentricity = 1.3 + Math.random() * 0.8;
            angle = ang;
            noiseScale = 10.0 + Math.random() * 5.0;
          } else if (i < 9) {
            // MIDGROUND WALL & STALACTITE FRAGMENTS (curved rock facets, slightly delayed)
            const ang = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.8;
            const dist = 0.10 + Math.random() * 0.12;
            u = clampedU + Math.cos(ang) * dist;
            v = clampedV + Math.sin(ang) * dist;
            const isVertical = Math.abs(Math.sin(ang)) > 0.6;
            radius = 0.12 + Math.random() * 0.06;
            targetOpacity = 0.38 + Math.random() * 0.22; // 0.38 - 0.60
            birthDelay = 0.10 + Math.random() * 0.10;    // ~150ms
            riseTime = 0.14;
            peakTime = 0.48 + Math.random() * 0.18;      // ~550ms
            decayTime = 1.15 + Math.random() * 0.25;     // ~1300ms
            eccentricity = isVertical ? 2.5 + Math.random() * 0.8 : 1.5 + Math.random() * 0.6;
            angle = isVertical ? Math.PI * 0.5 + (Math.random() - 0.5) * 0.2 : ang;
            noiseScale = 9.0 + Math.random() * 4.0;
          } else if (i < 14) {
            // STEPPED FLOOR & ALCOVE RETURNING ECHOES (depth awareness, later arrival)
            const ang = (i / 5) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
            const dist = 0.18 + Math.random() * 0.14;
            u = clampedU + Math.cos(ang) * dist;
            v = clampedV + Math.sin(ang) * dist;
            radius = 0.13 + Math.random() * 0.07;
            targetOpacity = 0.26 + Math.random() * 0.18; // 0.26 - 0.44
            birthDelay = 0.18 + Math.random() * 0.12;    // ~250ms
            riseTime = 0.18;
            peakTime = 0.58 + Math.random() * 0.22;      // ~700ms
            decayTime = 1.30 + Math.random() * 0.30;     // ~1500ms
            eccentricity = 1.8 + Math.random() * 1.0;
            angle = Math.random() * Math.PI;
            noiseScale = 7.5 + Math.random() * 3.5;
          } else {
            // DISTANT CAVERN ARCH & RECESSED VOID (faint, late peripheral echo)
            const ang = Math.random() * Math.PI * 2;
            const dist = 0.26 + Math.random() * 0.16;
            u = clampedU + Math.cos(ang) * dist;
            v = clampedV + Math.sin(ang) * dist;
            radius = 0.14 + Math.random() * 0.08;
            targetOpacity = 0.14 + Math.random() * 0.14; // 0.14 - 0.28
            birthDelay = 0.28 + Math.random() * 0.14;    // ~350ms
            riseTime = 0.22;
            peakTime = 0.68 + Math.random() * 0.25;      // ~800ms
            decayTime = 1.45 + Math.random() * 0.25;     // ~1600ms
            eccentricity = 1.4 + Math.random() * 0.6;
            angle = Math.random() * Math.PI;
            noiseScale = 6.5 + Math.random() * 3.0;
          }

          // Write to uniform arrays
          fragDataA[i * 4 + 0] = Math.max(0.05, Math.min(0.95, u));
          fragDataA[i * 4 + 1] = Math.max(0.05, Math.min(0.95, v));
          fragDataA[i * 4 + 2] = radius;
          fragDataA[i * 4 + 3] = targetOpacity;

          fragDataB[i * 4 + 0] = time + birthDelay;
          fragDataB[i * 4 + 1] = riseTime;
          fragDataB[i * 4 + 2] = peakTime;
          fragDataB[i * 4 + 3] = decayTime;

          fragDataC[i * 4 + 0] = noiseScale;
          fragDataC[i * 4 + 1] = eccentricity;
          fragDataC[i * 4 + 2] = angle;
          fragDataC[i * 4 + 3] = 0.0;
        }

        if (materialRef.current) {
          materialRef.current.uniforms.uFragCount.value = count;
        }
      } else if (event === 'thunder') {
        thunderStartTimeRef.current = data.time;
      }
    });

    return unsubscribe;
  }, [planeWidth, planeHeight, fragDataA, fragDataB, fragDataC]);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    if (!materialRef.current) return;

    materialRef.current.uniforms.uTime.value = time;
    materialRef.current.uniforms.uScreenSize.value.set(size.width, size.height);

    // Dynamic double-strike lightning flicker envelope
    const thunderDt = time - thunderStartTimeRef.current;
    let thunderVal = 0.0;
    if (thunderDt >= 0.0 && thunderDt < 0.48) {
      if (thunderDt < 0.05) {
        thunderVal = (thunderDt / 0.05) * 0.92;
      } else if (thunderDt < 0.10) {
        thunderVal = 0.92 - ((thunderDt - 0.05) / 0.05) * 0.62; // dip to 0.30
      } else if (thunderDt < 0.16) {
        thunderVal = 0.30 + ((thunderDt - 0.10) / 0.06) * 0.70; // peak to 1.00
      } else if (thunderDt < 0.24) {
        thunderVal = 1.00 - ((thunderDt - 0.16) / 0.08) * 0.52; // dip to 0.48
      } else {
        const decayNorm = (thunderDt - 0.24) / 0.24;
        thunderVal = 0.48 * Math.exp(-decayNorm * 4.2);
      }
    }
    materialRef.current.uniforms.uThunderIntensity.value = thunderVal;
  });

  return (
    <mesh
      ref={meshRef}
      position={[0, 0, -8.5]}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      <shaderMaterial
        ref={materialRef}
        vertexShader={caveVertexShader}
        fragmentShader={caveFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
      />
    </mesh>
  );
}
