import type { SoundName } from '../view/animate';

/**
 * All sound is synthesized with WebAudio at runtime — no assets, no
 * licensing, a few hundred bytes of code. Quiet, felted, parlor-appropriate.
 * Off by default.
 */
export class Sound {
  enabled = false;
  private ctx: AudioContext | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** Must be called from a user gesture at least once. */
  unlock(): void {
    if (!this.enabled) return;
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
      } catch {
        return;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  play(name: SoundName): void {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    switch (name) {
      case 'move':
        this.slide(0.05, 900);
        break;
      case 'deal':
        this.slide(0.09, 700);
        break;
      case 'flip':
        this.tick(1200);
        break;
      case 'invalid':
        this.thud();
        break;
      case 'complete':
        this.arpeggio([392, 494, 587, 784], 0.09);
        break;
      case 'win':
        this.arpeggio([330, 415, 494, 659, 831, 988], 0.14);
        break;
    }
  }

  private noise(): AudioBuffer {
    const ctx = this.ctx!;
    if (!this.noiseBuffer) {
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuffer = buffer;
    }
    return this.noiseBuffer;
  }

  /** Card sliding on cloth: a short filtered noise swish. */
  private slide(duration: number, cutoff: number): void {
    const ctx = this.ctx!;
    const source = ctx.createBufferSource();
    source.buffer = this.noise();
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + duration * 0.3);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start();
    source.stop(ctx.currentTime + duration + 0.02);
  }

  private tick(frequency: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.035, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.05);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.06);
  }

  private thud(): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(70, ctx.currentTime + 0.12);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.14);
    osc.connect(gain).connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.16);
  }

  private arpeggio(frequencies: number[], step: number): void {
    const ctx = this.ctx!;
    frequencies.forEach((frequency, i) => {
      const osc = ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = frequency;
      const gain = ctx.createGain();
      const at = ctx.currentTime + i * step;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.05, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + step * 2.4);
      osc.connect(gain).connect(ctx.destination);
      osc.start(at);
      osc.stop(at + step * 2.6);
    });
  }
}
