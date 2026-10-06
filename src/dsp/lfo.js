import { clamp, wrap01 } from './math.js';
import { sanitizeSample } from './safety.js';

function seeded(seed) {
  let state = (Math.trunc(seed) || 1) >>> 0;
  return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return ((state >>> 0) / 4294967296) * 2 - 1; };
}

function waveformSample(waveform, phase) {
  switch (waveform) {
    case 'triangle': return 1 - 4 * Math.abs(wrap01(phase) - 0.5);
    case 'saw': return 2 * wrap01(phase) - 1;
    case 'reverse-saw': return 1 - 2 * wrap01(phase);
    case 'square': return wrap01(phase) < 0.5 ? 1 : -1;
    case 'sine':
    default: return Math.sin(2 * Math.PI * wrap01(phase));
  }
}

export class LFO {
  constructor({ sampleRate = 48000, waveform = 'sine', frequency = 1, phase = 0, polarity = 'bipolar', amount = 1, seed = 1, steps = 8 } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.waveform = waveform;
    this.phase = wrap01(phase);
    this.frequency = clamp(Number.isFinite(frequency) ? Math.abs(frequency) : 0, 0, sampleRate * 0.499);
    this.polarity = polarity;
    this.amount = clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
    this.seed = seed;
    this.steps = Math.max(2, Math.round(steps));
    this.random = seeded(seed);
    this.randomValue = this.random();
    this.randomNext = this.random();
    this.lastCycle = Math.floor(this.phase);
  }

  reset(phase = 0) {
    this.phase = wrap01(phase);
    this.random = seeded(this.seed);
    this.randomValue = this.random();
    this.randomNext = this.random();
    this.lastCycle = 0;
  }

  nextSample() {
    const before = this.phase;
    let value;
    if (this.waveform === 'sample-hold' || this.waveform === 'stepped-random' || this.waveform === 'smooth-random') {
      value = this.waveform === 'smooth-random'
        ? this.randomValue + (this.randomNext - this.randomValue) * before
        : this.randomValue;
      if (this.waveform === 'stepped-random') value = Math.round(value * this.steps) / this.steps;
    } else value = waveformSample(this.waveform, before);
    if (this.polarity === 'unipolar') value = (value + 1) * 0.5;
    value *= this.amount;
    const next = before + this.frequency / this.sampleRate;
    if (next >= 1) {
      this.randomValue = this.randomNext;
      this.randomNext = this.random();
    }
    this.phase = wrap01(next);
    return sanitizeSample(value);
  }

  renderBlock(length) {
    const output = new Float32Array(Math.max(0, Math.floor(length)));
    for (let i = 0; i < output.length; i += 1) output[i] = this.nextSample();
    return output;
  }
}
