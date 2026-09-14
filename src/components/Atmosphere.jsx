import React, { useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import { PALETTE } from '../constants';
import { interactionSystem } from '../systems/InteractionSystem';

export default function Atmosphere({ enablePostprocessing = true }) {
  const ambientLightRef = useRef();
  const dirLightRef = useRef();
  const thunderTimeRef = useRef(-100);

  useEffect(() => {
    const unsub = interactionSystem.subscribe((event, data) => {
      if (event === 'thunder') {
        thunderTimeRef.current = data.time;
      }
    });
    return unsub;
  }, []);

  useFrame((state) => {
    const time = state.clock.getElapsedTime();
    const dt = time - thunderTimeRef.current;
    let boost = 0.0;
    if (dt >= 0.0 && dt < 0.45) {
      if (dt < 0.16) {
        boost = (dt / 0.16) * 1.0;
      } else {
        boost = 1.0 * Math.exp(-(dt - 0.16) * 6.5);
      }
    }

    if (ambientLightRef.current) {
      ambientLightRef.current.intensity = 0.25 + boost * 0.45;
    }
    if (dirLightRef.current) {
      dirLightRef.current.intensity = 0.18 + boost * 0.85;
    }
  });

  return (
    <>
      {/* 80% Absolute Darkness */}
      <color attach="background" args={[PALETTE.bg]} />
      <fog attach="fog" args={[PALETTE.bg, 8, 35]} />

      {/* Very subtle ambient depth */}
      <ambientLight ref={ambientLightRef} color={PALETTE.depth} intensity={0.25} />

      {/* Delicate distant rim lights */}
      <directionalLight
        ref={dirLightRef}
        position={[6, 10, 5]}
        color={PALETTE.violet}
        intensity={0.18}
      />
      <directionalLight
        position={[-6, -6, -3]}
        color={PALETTE.cyan}
        intensity={0.14}
      />

      {/* Controlled cinematic bloom & vignette */}
      {enablePostprocessing && (
        <EffectComposer disableNormalPass multisampling={0}>
          <Bloom
            luminanceThreshold={0.7}
            luminanceSmoothing={0.8}
            intensity={0.7}
            mipmapBlur
          />
          <Vignette
            eskil={false}
            offset={0.32}
            darkness={0.92}
          />
        </EffectComposer>
      )}
    </>
  );
}
