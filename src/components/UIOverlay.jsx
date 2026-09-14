import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Info, X } from 'lucide-react';
import { audioSystem } from '../systems/AudioSystem';
import { interactionSystem } from '../systems/InteractionSystem';

export default function UIOverlay({ performanceTier = 'HIGH' }) {
  const [isMuted, setIsMuted] = useState(true);
  const [hasInteracted, setHasInteracted] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const [impactCount, setImpactCount] = useState(0);

  useEffect(() => {
    const unsubscribe = interactionSystem.subscribe((event, data) => {
      if (event === 'target_set' || (event === 'echolocation_impact' && !data?.isAuto)) {
        setHasInteracted(true);
      }
      if (event === 'echolocation_impact') {
        setImpactCount((c) => c + 1);
      }
    });
    return unsubscribe;
  }, []);

  const handleToggleAudio = (e) => {
    e.stopPropagation();
    const muted = audioSystem.toggleMute();
    setIsMuted(muted);
  };

  const handleToggleInfo = (e) => {
    e.stopPropagation();
    setShowInfo((prev) => !prev);
  };

  return (
    <div className="ui-overlay">
      {/* Top Header */}
      <header className="header-top">
        <div>
          <div className="brand-title">
            <span className="brand-dot" />
            BAT CLOUD
          </div>
          <p className="brand-sub">SENSE THE INVISIBLE</p>
        </div>

        {/* Minimal Audio & Info Controls */}
        <div className="nav-controls ui-interactive">
          <button
            onClick={handleToggleAudio}
            className="btn-icon"
            title={isMuted ? 'Enable Sound (Procedural Web Audio)' : 'Mute Sound'}
            aria-label={isMuted ? 'Enable Sound' : 'Mute Sound'}
          >
            {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
            <span>{isMuted ? 'MUTED' : 'ECHO ON'}</span>
          </button>

          <button
            onClick={handleToggleInfo}
            className="btn-icon"
            title="Scientific Info"
            aria-label="Toggle Information"
          >
            {showInfo ? <X size={15} /> : <Info size={15} />}
            <span>INFO</span>
          </button>
        </div>
      </header>

      {/* Info Drawer (Minimal, elegant, scientific) */}
      <aside
        className={`info-drawer ui-interactive ${showInfo ? '' : 'hidden'}`}
        aria-hidden={!showInfo}
      >
        <h2 className="drawer-title">ACOUSTIC SENSING ECOSYSTEM</h2>
        <p className="drawer-text">
          Bats emit modulated ultrasonic pulses to construct high-definition spatial maps of darkness.
          Click anywhere in the viewport to release a <em>Sonar Seed</em>. Its impact releases pressure waves that reveal hidden geometric structures and alert the particle ecosystem.
        </p>
        <div className="drawer-stats">
          <div className="stat-item">
            <span className="stat-label">Echo Pulses</span>
            <span className="stat-value">{impactCount}</span>
          </div>
          <div className="stat-item">
            <span className="stat-label">System Tier</span>
            <span className="stat-value">{performanceTier}</span>
          </div>
        </div>
      </aside>

      {/* Footer / Hero Subtitle & Interaction Instruction */}
      <footer className="footer-bottom">
        <p className="hero-quote">A WORLD REVEALED BY SOUND</p>
        <div className={`interaction-hint ${hasInteracted ? 'fade-out' : ''}`}>
          <span className="hint-icon" />
          <span>CLICK ANYWHERE TO SEND A PULSE</span>
        </div>
      </footer>
    </div>
  );
}
