import { clamp, wrap01 } from './math.js';
import { sanitizeSample } from './safety.js';

function waveformSample(waveform, phase) {
  switch (waveform) {
    case 'triangle': return 1 - 4 * Math.abs(wrap01(phase) - 0.5);
    case 'saw': return 2 * wrap01(phase) - 1;
    case 'square': return wrap01(phase) < 0.5 ? 1 : -1;
    case 'sine':
    default: return Math.sin(2 * Math.PI * wrap01(phase));
  }
}

export class LFO {
  constructor({ sampleRate = 48000, waveform = 'sine', frequency = 1, phase = 0, polarity = 'bipolar', amount = 1 } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.waveform = waveform;
    this.phase = wrap01(phase);
    this.frequency = clamp(Number.isFinite(frequency) ? Math.abs(frequency) : 0, 0, sampleRate * 0.499);
    this.polarity = polarity;
    this.amount = clamp(Number.isFinite(amount) ? amount : 0, 0, 1);
  }

  reset(phase = 0) {
    this.phase = wrap01(phase);
  }

  nextSample() {
    let value = waveformSample(this.waveform, this.phase);
    if (this.polarity === 'unipolar') value = (value + 1) * 0.5;
    value *= this.amount;
    this.phase = wrap01(this.phase + this.frequency / this.sampleRate);
    return sanitizeSample(value);
  }

  renderBlock(length) {
    const output = new Float32Array(Math.max(0, Math.floor(length)));
    for (let i = 0; i < output.length; i += 1) output[i] = this.nextSample();
    return output;
  }
}
