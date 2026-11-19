// Tiny WebAudio synth: all sound effects and the menu music are
// generated with oscillators — no audio files, no network.
export class SoundBank {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.musicTimer = null;
    this.musicStep = 0;
  }
  ensure() {
    if (!this.ctx) {
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { /* no audio */ }
    }
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
    return this.ctx;
  }
  toggleMute() { this.muted = !this.muted; return this.muted; }
  tone(freq, dur, type, vol, slideTo) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type || 'square';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(vol || 0.12, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    osc.connect(gain); gain.connect(ctx.destination);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
  noise(dur, vol, lowpass) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    const t0 = ctx.currentTime;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource(); src.buffer = buf;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(vol || 0.15, t0);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    let node = src;
    if (lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = lowpass; src.connect(f); node = f; }
    node.connect(gain); gain.connect(ctx.destination);
    src.start(t0);
  }
  shoot() { this.noise(0.09, 0.22, 2400); this.tone(190, 0.08, 'square', 0.1, 60); }
  crash() { this.noise(0.25, 0.3, 700); this.tone(90, 0.22, 'sawtooth', 0.14, 40); }
  pickup() { this.tone(660, 0.09, 'sine', 0.14); setTimeout(() => this.tone(990, 0.12, 'sine', 0.14), 80); }
  cash() { this.tone(880, 0.08, 'sine', 0.13); setTimeout(() => this.tone(1174, 0.1, 'sine', 0.13), 70); setTimeout(() => this.tone(1568, 0.16, 'sine', 0.13), 140); }
  sirenBlip() { this.tone(880, 0.22, 'sine', 0.05, 660); }
  missionOk() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.14), i * 110)); }
  missionFail() { [392, 330, 262, 196].forEach((f, i) => setTimeout(() => this.tone(f, 0.22, 'sawtooth', 0.1), i * 130)); }
  engineHum(speed01) {
    if (this.muted) return;
    const ctx = this.ensure(); if (!ctx) return;
    this.tone(50 + speed01 * 130, 0.12, 'sawtooth', 0.025);
  }
  // Loose laid-back bass + hats loop for menus and cruising.
  startMusic() {
    if (this.musicTimer || !this.ensure()) return;
    const bass = [110, 0, 130.8, 0, 98, 0, 146.8, 123.5];
    this.musicTimer = setInterval(() => {
      if (this.muted) return;
      const n = bass[this.musicStep % bass.length];
      if (n) this.tone(n, 0.42, 'triangle', 0.07);
      if (this.musicStep % 2 === 0) this.noise(0.03, 0.03, 6000);
      this.musicStep++;
    }, 240);
  }
  stopMusic() { if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; } }
}
