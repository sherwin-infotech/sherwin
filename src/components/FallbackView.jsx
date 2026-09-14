import React, { useState } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { audioSystem } from '../systems/AudioSystem';

export default function FallbackView() {
  const [isMuted, setIsMuted] = useState(true);
  const [pulses, setPulses] = useState([]);

  const handleClick = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = Date.now();

    audioSystem.playLaunchChirp();
    setTimeout(() => {
      audioSystem.playEcholocationImpact();
    }, 150);

    setPulses((prev) => [...prev.slice(-6), { id, x, y }]);
  };

  const handleToggleAudio = (e) => {
    e.stopPropagation();
    const muted = audioSystem.toggleMute();
    setIsMuted(muted);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: '#050505',
        color: '#F5F7FA',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '2.5rem',
        overflow: 'hidden',
        cursor: 'crosshair',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 10 }}>
        <div>
          <h1 style={{ letterSpacing: '0.25em', fontSize: '1.4rem', fontWeight: 700 }}>BAT CLOUD</h1>
          <p style={{ letterSpacing: '0.15em', fontSize: '0.75rem', opacity: 0.5, marginTop: '0.3rem' }}>
            SENSE THE INVISIBLE (CANVAS FALLBACK)
          </p>
        </div>
        <button
          onClick={handleToggleAudio}
          className="btn-icon"
          style={{ pointerEvents: 'auto' }}
        >
          {isMuted ? <VolumeX size={15} /> : <Volume2 size={15} />}
          <span>{isMuted ? 'MUTED' : 'ECHO ON'}</span>
        </button>
      </div>

      {pulses.map((p) => (
        <div
          key={p.id}
          style={{
            position: 'absolute',
            left: p.x,
            top: p.y,
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
          }}
        >
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: '#5EEBFF',
              boxShadow: '0 0 15px #5EEBFF',
            }}
          />
          <div
            style={{
              position: 'absolute',
              inset: '-40px',
              borderRadius: '50%',
              border: '1px solid #5EEBFF',
              animation: 'loader-expand 1.8s forwards cubic-bezier(0.1, 0.8, 0.3, 1)',
            }}
          />
        </div>
      ))}

      <div style={{ textAlign: 'center', zIndex: 10 }}>
        <p style={{ letterSpacing: '0.2em', fontSize: '0.85rem', color: '#5EEBFF' }}>
          CLICK ANYWHERE TO ECHO
        </p>
      </div>
    </div>
  );
}
