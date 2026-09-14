import React, { useRef, useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { interactionSystem } from '../systems/InteractionSystem';
import { PALETTE, WAVE_CONFIG } from '../constants';

const MAX_RETURN_PARTICLES = 20;

export default function SonarWave() {
  const returnParticlesRef = useRef();

  // Acoustic reflection return particles (traveling back from detected objects to Sonar Seed)
  const returnParticleData = useMemo(() => {
    const data = [];
    const positions = new Float32Array(MAX_RETURN_PARTICLES * 3);
    for (let i = 0; i < MAX_RETURN_PARTICLES; i++) {
      data.push({
        active: false,
        origin: new THREE.Vector3(),
        startPos: new THREE.Vector3(),
        progress: 1.0,
        speed: 1.1,
        curveOffset: new THREE.Vector3(),
      });
      positions[i * 3] = 0;
      positions[i * 3 + 1] = 0;
      positions[i * 3 + 2] = -100;
    }
    return { data, positions };
  }, []);

  useEffect(() => {
    const unsubscribe = interactionSystem.subscribe((event, data) => {
      if (event === 'echolocation_impact') {
        const { origin } = data;

        // Spawn a small number of returning acoustic reflection sparks
        let spawned = 0;
        returnParticleData.data.forEach((p) => {
          if (!p.active && spawned < 8) {
            p.active = true;
            p.progress = 0.0;
            const angle = Math.random() * Math.PI * 2;
            const dist = 2.5 + Math.random() * 4.5;
            p.startPos.set(
              origin.x + Math.cos(angle) * dist,
              origin.y + Math.sin(angle) * dist,
              origin.z + (Math.random() - 0.5) * 3.0
            );
            p.origin.copy(origin);
            p.curveOffset.set(
              (Math.random() - 0.5) * 2.5,
              (Math.random() - 0.5) * 1.8,
              (Math.random() - 0.5) * 1.8
            );
            p.speed = 0.8 + Math.random() * 0.35;
            spawned++;
          }
        });
      }
    });

    return unsubscribe;
  }, [returnParticleData]);

  useFrame((state, delta) => {
    const dt = Math.min(delta, 0.05);

    // Update returning acoustic echo reflection particles
    if (returnParticlesRef.current) {
      const positions = returnParticlesRef.current.geometry.attributes.position.array;
      const seedPos = interactionSystem.currentPos;

      returnParticleData.data.forEach((p, idx) => {
        if (p.active) {
          p.progress += dt * p.speed;
          if (p.progress >= 1.0) {
            p.active = false;
            positions[idx * 3 + 2] = -100;
          } else {
            const t = p.progress;
            const curvePeak = 3.5 * t * (1.0 - t);
            positions[idx * 3] = (1 - t) * p.startPos.x + t * seedPos.x + p.curveOffset.x * curvePeak;
            positions[idx * 3 + 1] = (1 - t) * p.startPos.y + t * seedPos.y + p.curveOffset.y * curvePeak;
            positions[idx * 3 + 2] = (1 - t) * p.startPos.z + t * seedPos.z + p.curveOffset.z * curvePeak;
          }
        }
      });
      returnParticlesRef.current.geometry.attributes.position.needsUpdate = true;
    }
  });

  return (
    <group>
      {/* Returning acoustic reflection streamers (reflected information traveling back to seed) */}
      <points ref={returnParticlesRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={MAX_RETURN_PARTICLES}
            array={returnParticleData.positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          size={0.04}
          color={PALETTE.highlight}
          transparent
          opacity={0.7}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          sizeAttenuation={true}
        />
      </points>
    </group>
  );
}

