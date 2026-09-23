export class SoundManager {
  private ctx: AudioContext | null = null;
  public isMuted: boolean = false;

  private engineOsc: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;

  private boostNode: AudioBufferSourceNode | null = null;
  private boostGain: GainNode | null = null;

  private driftNode: AudioBufferSourceNode | null = null;
  private driftGain: GainNode | null = null;

  constructor() {
    const unlock = () => {
      this.init();
      window.removeEventListener('keydown', unlock);
      window.removeEventListener('mousedown', unlock);
      window.removeEventListener('touchstart', unlock);
    };
    window.addEventListener('keydown', unlock);
    window.addEventListener('mousedown', unlock);
    window.addEventListener('touchstart', unlock);
  }

  public init(): void {
    if (this.ctx) return;
    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();
      this.setupEngineAudio();
      this.setupDriftAudio();
    } catch {
      console.warn('Web Audio API not supported');
    }
  }

  private setupEngineAudio(): void {
    if (!this.ctx) return;
    try {
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.setValueAtTime(45, this.ctx.currentTime);

      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.setValueAtTime(0.03, this.ctx.currentTime);

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(260, this.ctx.currentTime);

      this.engineOsc.connect(filter);
      filter.connect(this.engineGain);
      this.engineGain.connect(this.ctx.destination);
      this.engineOsc.start();
    } catch (e) {
      console.warn('Engine sound init error', e);
    }
  }

  private setupDriftAudio(): void {
    if (!this.ctx) return;
    try {
      const bufferSize = this.ctx.sampleRate * 2;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      this.driftNode = this.ctx.createBufferSource();
      this.driftNode.buffer = buffer;
      this.driftNode.loop = true;

      const bandpass = this.ctx.createBiquadFilter();
      bandpass.type = 'bandpass';
      bandpass.frequency.setValueAtTime(1400, this.ctx.currentTime);
      bandpass.Q.setValueAtTime(3.0, this.ctx.currentTime);

      this.driftGain = this.ctx.createGain();
      this.driftGain.gain.setValueAtTime(0.0001, this.ctx.currentTime);

      this.driftNode.connect(bandpass);
      bandpass.connect(this.driftGain);
      this.driftGain.connect(this.ctx.destination);
      this.driftNode.start();
    } catch {}
  }

  public updateEngine(speedKmh: number, throttle: number): void {
    if (!this.ctx || !this.engineOsc || !this.engineGain || this.isMuted) return;
    const baseFreq = 42;
    const speedFactor = Math.min(speedKmh / 140, 1) * 110;
    const throttleFactor = Math.abs(throttle) * 30;
    const targetFreq = baseFreq + speedFactor + throttleFactor;

    this.engineOsc.frequency.setTargetAtTime(targetFreq, this.ctx.currentTime, 0.08);
    const targetVolume = 0.03 + (Math.abs(throttle) > 0.05 ? 0.05 : 0.01) + (speedKmh / 140) * 0.04;
    this.engineGain.gain.setTargetAtTime(targetVolume, this.ctx.currentTime, 0.08);
  }

  public setDriftActive(active: boolean): void {
    if (!this.ctx || !this.driftGain || this.isMuted) return;
    const target = active ? 0.09 : 0.0001;
    this.driftGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.05);
  }

  public setBoostActive(active: boolean): void {
    if (!this.ctx || this.isMuted) return;

    if (active) {
      if (!this.boostNode) {
        const bufferSize = this.ctx.sampleRate * 2;
        const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
          data[i] = Math.random() * 2 - 1;
        }

        this.boostNode = this.ctx.createBufferSource();
        this.boostNode.buffer = buffer;
        this.boostNode.loop = true;

        const bandpass = this.ctx.createBiquadFilter();
        bandpass.type = 'bandpass';
        bandpass.frequency.setValueAtTime(500, this.ctx.currentTime);
        bandpass.Q.setValueAtTime(1.4, this.ctx.currentTime);

        this.boostGain = this.ctx.createGain();
        this.boostGain.gain.setValueAtTime(0.01, this.ctx.currentTime);
        this.boostGain.gain.linearRampToValueAtTime(0.2, this.ctx.currentTime + 0.12);

        this.boostNode.connect(bandpass);
        bandpass.connect(this.boostGain);
        this.boostGain.connect(this.ctx.destination);
        this.boostNode.start();
      }
    } else {
      if (this.boostNode && this.boostGain) {
        this.boostGain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.12);
        const oldNode = this.boostNode;
        setTimeout(() => {
          try {
            oldNode.stop();
            oldNode.disconnect();
          } catch {}
        }, 130);
        this.boostNode = null;
      }
    }
  }

  public playSonicBoom(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(320, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(30, this.ctx.currentTime + 0.35);

      gain.gain.setValueAtTime(0.35, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.38);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.4);
    } catch {}
  }

  public playJump(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(520, this.ctx.currentTime + 0.16);

      gain.gain.setValueAtTime(0.18, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.18);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.2);
    } catch {}
  }

  public playDodge(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(260, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(60, this.ctx.currentTime + 0.22);

      gain.gain.setValueAtTime(0.28, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.26);
    } catch {}
  }

  public playBallHit(intensity: number = 1): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180 + Math.min(intensity, 2.5) * 60, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(45, this.ctx.currentTime + 0.18);

      const vol = Math.min(Math.max(intensity * 0.25, 0.12), 0.45);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.2);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.22);
    } catch {}
  }

  public playGoal(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      [220, 277.18, 329.63, 440, 554.37].forEach((freq) => {
        if (!this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        gain.gain.setValueAtTime(0.09, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.01, this.ctx.currentTime + 2.4);

        osc.connect(gain);
        gain.connect(this.ctx.destination);
        osc.start();
        osc.stop(this.ctx.currentTime + 2.5);
      });
    } catch {}
  }

  public playGoalExplosion(): void {
    this.playGoal();
    this.playSonicBoom();
  }

  public playFreeze(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(1200, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(2400, this.ctx.currentTime + 0.25);

      gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.3);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.35);
    } catch {}
  }

  public playPowerupReady(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(440, this.ctx.currentTime);
      osc.frequency.setValueAtTime(880, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.28);
    } catch {}
  }

  public playCountdown(isFinal: boolean): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(isFinal ? 920 : 460, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.22, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + (isFinal ? 0.6 : 0.22));

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + (isFinal ? 0.65 : 0.25));
    } catch {}
  }

  public playBoostPickup(): void {
    if (!this.ctx || this.isMuted) return;
    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(587.33, this.ctx.currentTime);
      osc.frequency.setValueAtTime(739.99, this.ctx.currentTime + 0.07);
      osc.frequency.setValueAtTime(880.00, this.ctx.currentTime + 0.14);

      gain.gain.setValueAtTime(0.14, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.001, this.ctx.currentTime + 0.28);

      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {}
  }
}
