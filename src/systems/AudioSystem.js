// Procedural Web Audio API sound generator for BAT CLOUD echolocation
class AudioSystem {
  constructor() {
    this.ctx = null;
    this.muted = true;
    this.initialized = false;
    this.masterGain = null;
    this.ambientGain = null;
  }

  init() {
    if (this.initialized) return;
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      this.ctx = new AudioContext();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.45, this.ctx.currentTime);
      this.masterGain.connect(this.ctx.destination);
      this.initialized = true;
      this.startAmbience();
    } catch (e) {
      console.warn('AudioContext not supported or blocked:', e);
    }
  }

  toggleMute() {
    if (!this.initialized) {
      this.init();
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    this.muted = !this.muted;
    if (this.masterGain && this.ctx) {
      const targetGain = this.muted ? 0 : 0.45;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
    return this.muted;
  }

  setMuted(mute) {
    if (!this.initialized && !mute) {
      this.init();
    }
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      const targetGain = this.muted ? 0 : 0.45;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.05);
    }
  }

  startAmbience() {
    if (!this.ctx || !this.masterGain) return;
    try {
      // Sub-bass atmospheric drone
      const osc = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      this.ambientGain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(55, this.ctx.currentTime); // 55Hz A1
      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(110, this.ctx.currentTime);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      this.ambientGain.gain.setValueAtTime(0.08, this.ctx.currentTime);

      osc.connect(filter);
      osc2.connect(filter);
      filter.connect(this.ambientGain);
      this.ambientGain.connect(this.masterGain);

      osc.start();
      osc2.start();
    } catch (e) {
      console.warn('Could not start ambient drone:', e);
    }
  }

  // Chirp triggered when user clicks to launch the seed
  playLaunchChirp() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      // Ultrasonic down-chirp simulation (2400Hz down to 600Hz)
      osc.frequency.setValueAtTime(2200, now);
      osc.frequency.exponentialRampToValueAtTime(500, now + 0.12);

      gain.gain.setValueAtTime(0.2, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + 0.15);
    } catch (e) {
      // Audio node failure fallback
    }
  }

  // Echolocation impact pulse + reverberant spatial echo
  playEcholocationImpact() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;

      // 1. High crystalline ping
      const pingOsc = this.ctx.createOscillator();
      const pingGain = this.ctx.createGain();
      pingOsc.type = 'sine';
      pingOsc.frequency.setValueAtTime(1320, now);
      pingOsc.frequency.exponentialRampToValueAtTime(880, now + 0.4);
      pingGain.gain.setValueAtTime(0.35, now);
      pingGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

      pingOsc.connect(pingGain);
      pingGain.connect(this.masterGain);
      pingOsc.start(now);
      pingOsc.stop(now + 0.65);

      // 2. Sub-bass acoustic chest thump
      const subOsc = this.ctx.createOscillator();
      const subGain = this.ctx.createGain();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(38, now + 0.5);
      subGain.gain.setValueAtTime(0.4, now);
      subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);

      subOsc.connect(subGain);
      subGain.connect(this.masterGain);
      subOsc.start(now);
      subOsc.stop(now + 0.6);

      // 3. Staggered echo response (simulating cave geometry echo)
      [0.16, 0.32, 0.52].forEach((delayTime, idx) => {
        const echoOsc = this.ctx.createOscillator();
        const echoGain = this.ctx.createGain();
        echoOsc.type = 'triangle';
        echoOsc.frequency.setValueAtTime(880 * Math.pow(0.85, idx + 1), now + delayTime);
        const volume = 0.12 * Math.pow(0.55, idx + 1);
        echoGain.gain.setValueAtTime(volume, now + delayTime);
        echoGain.gain.exponentialRampToValueAtTime(0.0001, now + delayTime + 0.3);

        echoOsc.connect(echoGain);
        echoGain.connect(this.masterGain);
        echoOsc.start(now + delayTime);
        echoOsc.stop(now + delayTime + 0.32);
      });
    } catch (e) {
      // Ignore audio error
    }
  }

  // Rolling subterranean thunder effect with initial crack and low-frequency rumble
  playThunder() {
    if (this.muted || !this.ctx || !this.masterGain) return;
    try {
      const now = this.ctx.currentTime;

      // 1. Initial distant lightning crack / burst (filtered noise transient)
      const bufferSize = Math.floor(this.ctx.sampleRate * 0.35);
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.28));
      }
      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(420, now);
      noiseFilter.frequency.exponentialRampToValueAtTime(95, now + 0.3);
      noiseFilter.Q.setValueAtTime(1.8, now);

      const noiseGain = this.ctx.createGain();
      noiseGain.gain.setValueAtTime(0.22, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.32);

      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);
      noiseGain.connect(this.masterGain);
      noise.start(now);
      noise.stop(now + 0.35);

      // 2. Rolling subterranean sub-bass rumble
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const rumbleFilter = this.ctx.createBiquadFilter();
      const rumbleGain = this.ctx.createGain();

      osc1.type = 'sawtooth';
      osc1.frequency.setValueAtTime(72, now);
      osc1.frequency.exponentialRampToValueAtTime(32, now + 1.8);

      osc2.type = 'triangle';
      osc2.frequency.setValueAtTime(48, now);
      osc2.frequency.exponentialRampToValueAtTime(26, now + 1.6);

      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(150, now);
      rumbleFilter.frequency.exponentialRampToValueAtTime(42, now + 1.8);

      rumbleGain.gain.setValueAtTime(0.01, now);
      rumbleGain.gain.linearRampToValueAtTime(0.38, now + 0.08);
      rumbleGain.gain.exponentialRampToValueAtTime(0.16, now + 0.5);
      rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + 2.0);

      osc1.connect(rumbleFilter);
      osc2.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(this.masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 2.0);
      osc2.stop(now + 2.0);

      // 3. Secondary cavern echo reflections
      [0.22, 0.46].forEach((delayTime, idx) => {
        const echoOsc = this.ctx.createOscillator();
        const echoGain = this.ctx.createGain();
        echoOsc.type = 'triangle';
        echoOsc.frequency.setValueAtTime(55 * Math.pow(0.85, idx + 1), now + delayTime);
        echoGain.gain.setValueAtTime(0.12 * Math.pow(0.6, idx + 1), now + delayTime);
        echoGain.gain.exponentialRampToValueAtTime(0.0001, now + delayTime + 0.6);

        echoOsc.connect(echoGain);
        echoGain.connect(this.masterGain);
        echoOsc.start(now + delayTime);
        echoOsc.stop(now + delayTime + 0.65);
      });
    } catch (e) {
      // Audio node failure fallback
    }
  }
}

export const audioSystem = new AudioSystem();
