import React, { useMemo, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { interactionSystem } from '../systems/InteractionSystem';
import { PALETTE, BAT_CONFIG, WAVE_CONFIG } from '../constants';
import { randomRange } from '../utils/math';

// Custom GLSL shaders for organic, biological bat echolocation reveal and spanwise wing flexion
const batVertexShader = `
  attribute float aSpan;
  attribute float aEdge;

  attribute float aFlapPhase;
  attribute float aFlapSpeed;
  attribute float aReactionGlow;
  attribute float aIsGliding;

  uniform float uTime;

  varying float vGlow;
  varying float vEdge;
  varying float vSpan;

  void main() {
    vGlow = aReactionGlow;
    vEdge = aEdge;
    vSpan = aSpan;

    vec3 pos = position;

    // Organic spanwise wing flexion:
    // Torso / spine (aSpan = 0) remains steady and aligned to flight velocity
    // Wings flex with realistic non-rigid spanwise curvature and camber
    float flapCycle = sin(uTime * aFlapSpeed + aFlapPhase);

    if (aIsGliding > 0.5) {
      // Cambered biological glide profile
      float camber = sin(uTime * 1.4 + aFlapPhase) * 0.025;
      pos.y += pow(aSpan, 1.6) * (0.07 + camber);
      pos.z -= pow(aSpan, 2.0) * 0.04;
    } else {
      // Dynamic flapping stroke:
      // Inner wing has slight elevation, outer wingtips have full biological stroke
      pos.y += flapCycle * pow(aSpan, 1.45) * 0.68;
      // Aerodynamic trailing edge phase lag (wingtip twists backward on downstroke)
      pos.z += cos(uTime * aFlapSpeed + aFlapPhase) * pow(aSpan, 1.8) * 0.14;
    }

    vec4 mvPosition = modelViewMatrix * instanceMatrix * vec4(pos, 1.0);
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const batFragmentShader = `
  uniform vec3 uCyan;
  uniform vec3 uHighlight;
  uniform vec3 uViolet;

  varying float vGlow;
  varying float vEdge;
  varying float vSpan;

  void main() {
    // 100% INVISIBLE IN PITCH DARKNESS:
    // Dormant bats do not emit light and are completely hidden in the cave darkness
    // Progressive perception:
    // Frame 1-2: Wingtip apex (vSpan > 0.7) and curved leading spar (vEdge > 0.7) catch high-frequency echo first
    // Frame 3-4: Inner arm skeleton, wrist, elbow, and torso mass reveal at peak excitation
    // Frame 5-6: Body decays into darkness first, wingtip spars linger briefly before complete darkness
    float revealThreshold = mix(0.38, 0.02, vEdge * 0.55 + pow(vSpan, 1.2) * 0.45);
    if (vGlow < revealThreshold) {
      discard;
    }

    // Acoustic reflection color progression:
    // Soft violet resonance -> electric bioluminescent cyan -> bright highlight on leading edge/spars
    vec3 baseColor = mix(uViolet, uCyan, smoothstep(0.05, 0.70, vGlow));
    vec3 edgeHighlight = mix(baseColor, uHighlight, smoothstep(0.25, 0.95, vGlow));

    // Structural prominence: leading arm spar and articulated digit tips catch direct acoustic echo
    vec3 finalColor = mix(baseColor, edgeHighlight, vEdge);

    // Thin wing membrane is translucent and phantom-like (0.04)
    // Leading arm spar, shoulder, elbow, wrist, and digit tips are crisp and opaque (0.92)
    float edgeWeight = pow(vEdge, 2.2);
    float alpha = mix(0.04, 0.92, edgeWeight) * smoothstep(revealThreshold, revealThreshold + 0.35, vGlow);

    gl_FragColor = vec4(finalColor, alpha);
  }
`;

// Procedural generation of organic anatomical bat mesh with bilateral symmetry and scalloped trailing patagium
function buildBatGeometry() {
  const geo = new THREE.BufferGeometry();

  // Landmarks for left side (x <= 0)
  const H   = [0.0, 0.03, 0.44];       // Head / rostrum
  const EL  = [-0.07, 0.07, 0.40];     // Left Ear tip
  const N   = [0.0, 0.04, 0.28];       // Neck
  const C   = [0.0, 0.045, 0.12];      // Chest
  const B   = [0.0, 0.03, -0.08];      // Belly
  const P   = [0.0, 0.02, -0.22];      // Pelvis
  const T   = [0.0, 0.01, -0.36];      // Tail tip

  // Wing arm skeleton (curved leading edge)
  const S   = [-0.20, 0.035, 0.24];    // Shoulder
  const E   = [-0.65, 0.065, 0.26];    // Swept forward elbow
  const W   = [-1.18, 0.05, 0.16];     // Wrist
  const D2  = [-1.62, 0.02, 0.05];     // Digit II leading spar
  const D3  = [-2.18, -0.02, -0.16];   // Digit III Wingtip apex

  // Finger digits
  const D4  = [-1.68, -0.01, -0.34];   // Digit IV
  const D5  = [-1.12, 0.01, -0.38];    // Digit V
  const A   = [-0.24, 0.01, -0.28];    // Ankle / Leg

  // Scalloped trailing edge patagium bays
  const M34 = [-1.88, -0.01, -0.24];   // Bay between D3 and D4
  const M45 = [-1.36, 0.00, -0.33];    // Bay between D4 and D5
  const M5A = [-0.68, 0.01, -0.32];    // Bay between D5 and Ankle
  const MAT = [-0.12, 0.01, -0.32];    // Uropatagium bay between Ankle and Tail

  // Interior membrane nodes
  const MidInner = [-0.55, 0.03, -0.04];
  const MidOuter = [-1.15, 0.02, -0.10];

  const triangles = [
    // Head & Rostrum
    [H, EL, N],
    // Propatagium (leading membrane from neck to shoulder and elbow)
    [N, E, S],
    [N, S, C],
    [S, E, MidInner],
    // Torso & Plagiopatagium
    [C, S, B],
    [S, MidInner, B],
    [B, MidInner, P],
    // Inner wing & Ankle
    [P, MidInner, A],
    [MidInner, M5A, A],
    [MidInner, D5, M5A],
    // Mid Chiropatagium (elbow to wrist & digits)
    [E, W, MidOuter],
    [E, MidOuter, MidInner],
    [MidInner, MidOuter, D5],
    [MidOuter, M45, D5],
    [MidOuter, D4, M45],
    // Outer Wingtip (dactylopatagium)
    [W, D2, D3],
    [W, D3, MidOuter],
    [MidOuter, D3, M34],
    [MidOuter, M34, D4],
    // Uropatagium (tail membrane)
    [P, MAT, T],
    [P, A, MAT],
  ];

  const positions = [];
  const spans = [];
  const edges = [];

  const edgeSet = new Set([
    `${EL[0]},${EL[1]},${EL[2]}`,
    `${H[0]},${H[1]},${H[2]}`,
    `${T[0]},${T[1]},${T[2]}`,
    `${S[0]},${S[1]},${S[2]}`,
    `${E[0]},${E[1]},${E[2]}`,
    `${W[0]},${W[1]},${W[2]}`,
    `${D2[0]},${D2[1]},${D2[2]}`,
    `${D3[0]},${D3[1]},${D3[2]}`,
    `${D4[0]},${D4[1]},${D4[2]}`,
    `${D5[0]},${D5[1]},${D5[2]}`,
    `${M34[0]},${M34[1]},${M34[2]}`,
    `${M45[0]},${M45[1]},${M45[2]}`,
    `${M5A[0]},${M5A[1]},${M5A[2]}`,
    `${MAT[0]},${MAT[1]},${MAT[2]}`,
  ]);

  const addVertex = (p, isMirrored = false) => {
    const x = isMirrored ? -p[0] : p[0];
    const y = p[1];
    const z = p[2];

    positions.push(x, y, z);

    // Span normalized from 0.0 (torso) to 1.0 (wingtips)
    const span = Math.min(1.0, Math.abs(x) / 2.18);
    spans.push(span);

    const key = `${p[0]},${p[1]},${p[2]}`;
    edges.push(edgeSet.has(key) ? 1.0 : 0.15);
  };

  triangles.forEach(([p1, p2, p3]) => {
    // Left side
    addVertex(p1, false);
    addVertex(p2, false);
    addVertex(p3, false);

    // Right side (mirrored bilateral symmetry with reversed winding)
    addVertex(p1, true);
    addVertex(p3, true);
    addVertex(p2, true);
  });

  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('aSpan', new THREE.Float32BufferAttribute(spans, 1));
  geo.setAttribute('aEdge', new THREE.Float32BufferAttribute(edges, 1));
  geo.computeVertexNormals();

  return geo;
}

export default function BatEntities({ performanceTier = 'HIGH' }) {
  const meshRef = useRef();
  const materialRef = useRef();

  const batCount = useMemo(() => {
    if (performanceTier === 'LOW') return BAT_CONFIG.countMobile;
    if (performanceTier === 'MEDIUM') return BAT_CONFIG.countMedium;
    return BAT_CONFIG.countDesktop;
  }, [performanceTier]);

  const { geometry } = useMemo(() => {
    const geo = buildBatGeometry();

    const flapPhases = new Float32Array(batCount);
    const flapSpeeds = new Float32Array(batCount);
    const reactionGlows = new Float32Array(batCount);
    const isGlidings = new Float32Array(batCount);

    for (let i = 0; i < batCount; i++) {
      flapPhases[i] = Math.random() * Math.PI * 2;
      flapSpeeds[i] = randomRange(4.8, 6.8);
      reactionGlows[i] = 0.0;
      isGlidings[i] = 0.0;
    }

    geo.setAttribute('aFlapPhase', new THREE.InstancedBufferAttribute(flapPhases, 1));
    geo.setAttribute('aFlapSpeed', new THREE.InstancedBufferAttribute(flapSpeeds, 1));
    geo.setAttribute('aReactionGlow', new THREE.InstancedBufferAttribute(reactionGlows, 1));
    geo.setAttribute('aIsGliding', new THREE.InstancedBufferAttribute(isGlidings, 1));

    return { geometry: geo };
  }, [batCount]);

  const bats = useMemo(() => {
    const arr = [];
    for (let i = 0; i < batCount; i++) {
      arr.push({
        position: new THREE.Vector3(
          randomRange(-14, 14),
          randomRange(-4, 5.5),
          randomRange(-12, -2)
        ),
        velocity: new THREE.Vector3(
          randomRange(-0.8, 0.8),
          randomRange(-0.25, 0.25),
          randomRange(-0.35, 0.35)
        ).normalize().multiplyScalar(randomRange(2.4, 3.6)),
        glideTimer: Math.random() * 2.5,
        isGliding: false,
        reactionGlow: 0.0,
        // Natural proportional cavern scale (not giant)
        scale: randomRange(0.42, 0.62),
      });
    }
    return arr;
  }, [batCount]);

  const uniforms = useMemo(() => ({
    uTime: { value: 0 },
    uCyan: { value: new THREE.Color(PALETTE.cyan) },
    uHighlight: { value: new THREE.Color(PALETTE.highlight) },
    uViolet: { value: new THREE.Color(PALETTE.violet) },
  }), []);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Biological bat reaction when thunder strikes across the cavern
  useEffect(() => {
    const unsubscribe = interactionSystem.subscribe((event) => {
      if (event === 'thunder') {
        bats.forEach((bat) => {
          bat.isGliding = false;
          bat.glideTimer = randomRange(2.0, 3.5);
          // Dynamic scatter impulse into cavern depth
          bat.velocity.x += randomRange(-1.5, 1.5);
          bat.velocity.y += randomRange(-0.6, 1.0);
          bat.velocity.z -= randomRange(0.8, 2.2);
          bat.reactionGlow = Math.max(bat.reactionGlow, 0.95);
        });
      }
    });
    return unsubscribe;
  }, [bats]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const dt = Math.min(delta, 0.05);

    if (!meshRef.current || !materialRef.current) return;

    materialRef.current.uniforms.uTime.value = time;

    const glows = geometry.attributes.aReactionGlow.array;
    const glidings = geometry.attributes.aIsGliding.array;

    bats.forEach((bat, i) => {
      // Natural bat flap and glide cycle
      bat.glideTimer -= dt;
      if (bat.glideTimer <= 0) {
        bat.isGliding = !bat.isGliding;
        bat.glideTimer = bat.isGliding ? randomRange(1.2, 2.4) : randomRange(1.8, 3.6);
      }

      // Check active acoustic waves for localized arrival and excitation
      let waveExcitation = 0.0;
      const waves = interactionSystem.activeWaves;
      for (let w = 0; w < waves.length; w++) {
        const wave = waves[w];
        if (wave.age <= 0 || wave.age > WAVE_CONFIG.duration) continue;
        const dist = bat.position.distanceTo(wave.origin);
        if (dist > WAVE_CONFIG.maxRadius) continue;

        const arrivalTime = dist / WAVE_CONFIG.speed;
        const localAge = wave.age - arrivalTime;
        if (localAge >= 0.0 && localAge < 1.8) {
          const onset = Math.min(1.0, localAge / 0.08);
          const decay = Math.exp(-1.45 * localAge);
          const distAtten = Math.pow(Math.max(0, 1.0 - dist / WAVE_CONFIG.maxRadius), 2.2);
          const echo = onset * decay * distAtten * 2.8;
          waveExcitation = Math.max(waveExcitation, echo);

          // Bank smoothly away when sound wavefront arrives
          if (localAge < 0.08) {
            const fleeDir = new THREE.Vector3().subVectors(bat.position, wave.origin).normalize();
            fleeDir.y += 0.25;
            bat.velocity.addScaledVector(fleeDir, distAtten * 0.4);
            bat.isGliding = false;
            bat.glideTimer = randomRange(1.8, 3.0);
          }
        }
      }

      // Smooth flight banking and trajectory
      bat.velocity.x += Math.sin(time * 0.3 + i) * 0.22 * dt;
      bat.velocity.y += Math.cos(time * 0.25 + i * 1.5) * 0.16 * dt;

      // Cavern boundary steering
      const bX = 16, bY = 7, bZ = 15;
      if (Math.abs(bat.position.x) > bX) bat.velocity.x -= Math.sign(bat.position.x) * 4.0 * dt;
      if (Math.abs(bat.position.y) > bY) bat.velocity.y -= Math.sign(bat.position.y) * 4.0 * dt;
      if (bat.position.z > 0) bat.velocity.z -= 4.0 * dt;
      if (bat.position.z < -bZ) bat.velocity.z += 4.0 * dt;

      const speed = bat.velocity.length();
      const targetSpeed = bat.reactionGlow > 0.3 ? 3.6 : 2.4;
      bat.velocity.multiplyScalar(THREE.MathUtils.lerp(1.0, targetSpeed / (speed + 0.001), dt * 1.6));

      bat.position.addScaledVector(bat.velocity, dt);

      dummy.position.copy(bat.position);
      dummy.lookAt(bat.position.clone().add(bat.velocity));

      const s = bat.scale;
      dummy.scale.set(s, s, s);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);

      // Acoustic reaction glow: takes peak of wave excitation or decays smoothly
      bat.reactionGlow = Math.max(bat.reactionGlow - dt * 0.75, waveExcitation);

      glows[i] = bat.reactionGlow;
      glidings[i] = bat.isGliding ? 1.0 : 0.0;
    });

    geometry.attributes.aReactionGlow.needsUpdate = true;
    geometry.attributes.aIsGliding.needsUpdate = true;
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, null, batCount]}
    >
      <shaderMaterial
        ref={materialRef}
        vertexShader={batVertexShader}
        fragmentShader={batFragmentShader}
        uniforms={uniforms}
        transparent
        depthWrite={false}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </instancedMesh>
  );
}
