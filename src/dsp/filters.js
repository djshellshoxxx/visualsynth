import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export class StateVariableFilter {
  constructor({ sampleRate = 48000, cutoff = 1000, resonance = 0, mode = 'lowpass' } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.mode = mode;
    this.ic1eq = 0;
    this.ic2eq = 0;
    this.setCutoff(cutoff);
    this.setResonance(resonance);
  }

  setCutoff(cutoff) {
    this.cutoff = clamp(Number.isFinite(cutoff) ? cutoff : 20, 5, this.sampleRate * 0.45);
  }

  setResonance(resonance) {
    this.resonance = clamp(Number.isFinite(resonance) ? resonance : 0, 0, 1);
  }

  reset() {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }

  processSample(input) {
    const x = sanitizeSample(input);
    const g = Math.tan(Math.PI * this.cutoff / this.sampleRate);
    const q = 0.5 + this.resonance * 19.5;
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;

    const v3 = x - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;

    this.ic1eq = sanitizeSample(2 * v1 - this.ic1eq);
    this.ic2eq = sanitizeSample(2 * v2 - this.ic2eq);

    const low = v2;
    const band = v1;
    const high = x - k * band - low;
    const notch = high + low;

    switch (this.mode) {
      case 'highpass': return sanitizeSample(high);
      case 'bandpass': return sanitizeSample(band);
      case 'notch': return sanitizeSample(notch);
      case 'lowpass':
      default: return sanitizeSample(low);
    }
  }

  renderBlock(input) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i += 1) output[i] = this.processSample(input[i]);
    return output;
  }
}
