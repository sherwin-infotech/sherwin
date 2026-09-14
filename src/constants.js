// Curated minimal aesthetic palette and spatial configuration for BAT CLOUD
export const PALETTE = {
  bg: '#020405',
  depth: '#050c10',
  cyan: '#8BE9FD',
  highlight: '#C7F9FF',
  violet: '#7868E6',
  warmAccent: '#D9B77A',
  whiteHighlight: '#FFFFFF',
};

export const ORB_CONFIG = {
  // Asymmetric, natural resting position (slightly off-center)
  initialPosition: [-0.75, 0.35, 1.2],
  springStiffness: 0.045,
  springDamping: 0.85,
  idleFloatFrequency: 0.75,
  idleFloatAmplitude: 0.12,
  coreRadius: 0.065,
  particleClusterCount: 18,
};

export const WAVE_CONFIG = {
  duration: 2.2,
  maxRadius: 9.0, // Strictly localized acoustic reach (preserves >90% darkness)
  speed: 12.5,
  falloffExponent: 2.8,
};

export const PARTICLE_CONFIG = {
  totalCountDesktop: 140, // Subtle supporting particles only; Cave.png is the environment
  totalCountMedium: 95,
  totalCountMobile: 55,
  areaWidth: 32,
  areaHeight: 20,
  areaDepth: 24,
};

export const BAT_CONFIG = {
  countDesktop: 7,
  countMedium: 5,
  countMobile: 3,
};
