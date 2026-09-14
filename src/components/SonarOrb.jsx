import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { interactionSystem } from '../systems/InteractionSystem';
import { PALETTE, ORB_CONFIG } from '../constants';

export default function SonarOrb() {
  const groupRef = useRef();
  const coreSparkRef = useRef();
  const microParticlesRef = useRef();
  const lightRef = useRef();

  // Organic, irregular micro-particles forming the unstable acoustic energy entity
  const particleCount = ORB_CONFIG.particleClusterCount;
  const { initialOffsets, particleDynamics } = useMemo(() => {
    const pos = new Float32Array(particleCount * 3);
    const dynamics = [];

    for (let i = 0; i < particleCount; i++) {
      const radius = 0.04 + Math.random() * 0.07;
      const theta = Math.random() * Math.PI * 2;
      const phi = (Math.random() - 0.5) * Math.PI;
      const speed = 1.8 + Math.random() * 2.5;

      dynamics.push({
        baseRadius: radius,
        theta,
        phi,
        speed,
        phase: Math.random() * Math.PI * 2,
        jitterSpeed: 4.0 + Math.random() * 6.0,
      });

      pos[i * 3] = Math.cos(theta) * Math.cos(phi) * radius;
      pos[i * 3 + 1] = Math.sin(phi) * radius;
      pos[i * 3 + 2] = Math.sin(theta) * Math.cos(phi) * radius;
    }

    return { initialOffsets: pos, particleDynamics: dynamics };
  }, [particleCount]);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const clampedDelta = Math.min(delta, 0.05);

    // Update physical trajectory in interactionSystem
    interactionSystem.update(clampedDelta, time);
    const pos = interactionSystem.currentPos;

    if (groupRef.current) {
      groupRef.current.position.copy(pos);
    }

    // Unstable, alive acoustic micro-flicker
    if (coreSparkRef.current) {
      const jitter = 0.95 + Math.sin(time * 8.0) * 0.08 + Math.cos(time * 14.0) * 0.05;
      coreSparkRef.current.scale.set(jitter, jitter * 1.05, jitter * 0.92);
      coreSparkRef.current.rotation.x += clampedDelta * 1.2;
      coreSparkRef.current.rotation.y -= clampedDelta * 1.6;
    }

    if (lightRef.current) {
      // Concentrated bioluminescent breathing
      lightRef.current.intensity = 1.6 + Math.sin(time * 5.0) * 0.4 + Math.cos(time * 11.0) * 0.2;
    }

    // Orbiting, irregular micro-energy dust particles (buzzing sound energy)
    if (microParticlesRef.current) {
      const positions = microParticlesRef.current.geometry.attributes.position.array;

      for (let i = 0; i < particleCount; i++) {
        const p = particleDynamics[i];
        p.theta += p.speed * clampedDelta;
        
        // High-frequency acoustic vibration
        const r = p.baseRadius * (1.0 + Math.sin(time * p.jitterSpeed + p.phase) * 0.28);
        positions[i * 3] = Math.cos(p.theta) * Math.cos(p.phi) * r;
        positions[i * 3 + 1] = Math.sin(p.phi) * r + Math.cos(time * 6.0 + p.phase) * 0.015;
        positions[i * 3 + 2] = Math.sin(p.theta) * Math.cos(p.phi) * r;
      }
      microParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group ref={groupRef} position={ORB_CONFIG.initialPosition}>
      {/* Concentrated point light */}
      <pointLight
        ref={lightRef}
        color={PALETTE.highlight}
        intensity={1.8}
        distance={7}
        decay={2.2}
      />

      {/* 1. Concentrated Irregular Core Spark (Tiny organic crystal, NO concentric target discs) */}
      <mesh ref={coreSparkRef}>
        <octahedronGeometry args={[ORB_CONFIG.coreRadius, 0]} />
        <meshBasicMaterial
          color={PALETTE.whiteHighlight}
          toneMapped={false}
        />
      </mesh>

      {/* 2. Swarm of Irregular Buzzing Micro-Energy Particles */}
      <points ref={microParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={particleCount}
            array={initialOffsets}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          color={PALETTE.cyan}
          transparent
          opacity={0.88}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation={true}
        />
      </points>
    </group>
  );
}
