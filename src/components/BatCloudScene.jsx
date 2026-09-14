import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import Atmosphere from './Atmosphere';
import CameraController from './CameraController';
import SonarOrb from './SonarOrb';
import SonarWave from './SonarWave';
import ParticleEnvironment from './ParticleEnvironment';
import BatEntities from './BatEntities';
import CaveEnvironment from './CaveEnvironment';
import { interactionSystem } from '../systems/InteractionSystem';

import { useThree } from '@react-three/fiber';

// Click-interception plane in 3D scene (must have visible=true for Three.js raycasting)
function InteractionSurface() {
  const { camera } = useThree();

  React.useEffect(() => {
    interactionSystem.camera = camera;
  }, [camera]);

  const handleClick = (e) => {
    e.stopPropagation();
    if (e.point) {
      interactionSystem.setTargetPoint(e.point);
    } else {
      interactionSystem.handlePointerDown(e.clientX, e.clientY, camera);
    }
  };

  return (
    <mesh
      onPointerDown={handleClick}
      position={[0, 0, 0]}
    >
      <planeGeometry args={[200, 200]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export default function BatCloudScene({
  performanceTier = 'HIGH',
  children,
}) {
  return (
    <div className="canvas-container">
      <Canvas
        camera={{ position: [0, 0, 15], fov: 55, near: 0.1, far: 100 }}
        gl={{
          antialias: performanceTier !== 'LOW',
          alpha: false,
          powerPreference: 'high-performance',
          stencil: false,
          depth: true,
        }}
        dpr={performanceTier === 'HIGH' ? [1, 2] : [1, 1.5]}
      >
        <Suspense fallback={null}>
          <Atmosphere enablePostprocessing={performanceTier !== 'LOW'} />
          <CameraController />

          {/* Core environmental cave background layer */}
          <CaveEnvironment />

          {/* Core interactive plane and elements */}
          <InteractionSurface />
          <ParticleEnvironment performanceTier={performanceTier} />
          <BatEntities performanceTier={performanceTier} />
          <SonarOrb />
          <SonarWave />

          {/* Phase 2 and 3 dynamic slots */}
          {children}
        </Suspense>
      </Canvas>
    </div>
  );
}
