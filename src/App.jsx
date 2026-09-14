import React, { useState, useEffect } from 'react';
import BatCloudScene from './components/BatCloudScene';
import UIOverlay from './components/UIOverlay';
import FallbackView from './components/FallbackView';

function isWebGLSupported() {
  try {
    const canvas = document.createElement('canvas');
    return !!(
      window.WebGLRenderingContext &&
      (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
    );
  } catch (e) {
    return false;
  }
}

function detectPerformanceTier() {
  if (typeof window === 'undefined') return 'HIGH';
  
  // Multiple signals: userAgent, touch, coarse pointer, screen size, aspect ratio, DPR, hardware cores, memory
  const hasTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
  const isCoarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
  const width = window.innerWidth;
  const height = window.innerHeight;
  const minDim = Math.min(width, height);
  const dpr = window.devicePixelRatio || 1;
  const cores = navigator.hardwareConcurrency || 4;
  const deviceMemory = navigator.deviceMemory || 4; // in GB

  // Signal scoring
  let score = 10;

  if (isMobileUA || (hasTouch && isCoarsePointer && minDim < 600)) {
    score -= 4;
  }
  if (cores < 4) score -= 3;
  if (deviceMemory < 4) score -= 3;
  if (dpr > 2.5 && minDim < 500) score -= 1; // High-density small phone

  if (score <= 5) return 'LOW';
  if (score <= 7) return 'MEDIUM';
  return 'HIGH';
}

export default function App() {
  const [hasWebGL, setHasWebGL] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [tier, setTier] = useState('HIGH');

  useEffect(() => {
    if (!isWebGLSupported()) {
      setHasWebGL(false);
      setIsLoading(false);
      return;
    }

    setTier(detectPerformanceTier());

    // Minimal smooth loading transition
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 700);

    return () => clearTimeout(timer);
  }, []);

  if (!hasWebGL) {
    return <FallbackView />;
  }

  return (
    <main style={{ position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden' }}>
      {/* Minimal cinematic loader */}
      {isLoading && (
        <div className="loader-overlay" aria-live="polite">
          <div className="loader-seed-dot" />
          <p className="loader-text">INITIALIZING ECHO SYSTEM</p>
        </div>
      )}

      {/* 3D Scene */}
      <BatCloudScene performanceTier={tier} />

      {/* Minimal HUD overlay */}
      <UIOverlay performanceTier={tier} />
    </main>
  );
}
