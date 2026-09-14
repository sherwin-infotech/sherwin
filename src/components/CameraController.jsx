import { useRef, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

export default function CameraController() {
  const { camera } = useThree();
  const mouse = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const isReducedMotion = useRef(false);
  const isMobile = useRef(false);

  useEffect(() => {
    isReducedMotion.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    isMobile.current = window.innerWidth < 768;

    const handlePointerMove = (e) => {
      if (isReducedMotion.current) return;
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      const factor = isMobile.current ? 0.25 : 0.85;
      mouse.current.targetX = x * factor;
      mouse.current.targetY = y * factor;
    };

    const handleResize = () => {
      isMobile.current = window.innerWidth < 768;
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  useFrame((state, delta) => {
    const time = state.clock.getElapsedTime();
    const clampedDelta = Math.min(delta, 0.05);

    // Smooth damping
    mouse.current.x = THREE.MathUtils.damp(mouse.current.x, mouse.current.targetX, 2.5, clampedDelta);
    mouse.current.y = THREE.MathUtils.damp(mouse.current.y, mouse.current.targetY, 2.5, clampedDelta);

    // Gentle camera floating breathing motion
    const floatY = Math.sin(time * 0.4) * 0.15;
    const floatX = Math.cos(time * 0.3) * 0.15;

    camera.position.x = mouse.current.x + floatX;
    camera.position.y = mouse.current.y * 0.6 + floatY;
    camera.lookAt(0, 0, 0);
  });

  return null;
}
