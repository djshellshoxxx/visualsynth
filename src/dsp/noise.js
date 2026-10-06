import { sanitizeSample } from './safety.js';

function normalizeSeed(seed) {
  const value = Number.isFinite(seed) ? Math.trunc(seed) : 1;
  return (value >>> 0) || 1;
}

function xorshift32(state) {
  let next = state >>> 0;
  next ^= next << 13;
  next ^= next >>> 17;
  next ^= next << 5;
  return next >>> 0;
}

export class NoiseGenerator {
  constructor({ seed = 1, type = 'white' } = {}) {
    this.seed = normalizeSeed(seed);
    this.type = type;
    this.reset();
  }

  reset() {
    this.state = this.seed;
    this.pink0 = 0;
    this.pink1 = 0;
    this.pink2 = 0;
    this.brown = 0;
    this.lastWhite = 0;
  }

  #white() {
    this.state = xorshift32(this.state);
    return (this.state / 0xffffffff) * 2 - 1;
  }

  nextSample() {
    const white = this.#white();
    if (this.type === 'pink') {
      this.pink0 = 0.99765 * this.pink0 + white * 0.099046;
      this.pink1 = 0.963 * this.pink1 + white * 0.2965164;
      this.pink2 = 0.57 * this.pink2 + white * 1.0526913;
      return sanitizeSample((this.pink0 + this.pink1 + this.pink2 + white * 0.1848) * 0.05);
    }
    if (this.type === 'brown') {
      this.brown = Math.max(-1, Math.min(1, (this.brown + white * 0.02) / 1.02));
      return sanitizeSample(this.brown * 3.5);
    }
    if (this.type === 'blue') {
      const blue = (white - this.lastWhite) * 0.5;
      this.lastWhite = white;
      return sanitizeSample(blue);
    }
    this.lastWhite = white;
    return sanitizeSample(white);
  }

  renderBlock(length = 128) {
    const output = new Float32Array(Math.max(0, Math.floor(length)));
    for (let index = 0; index < output.length; index += 1) output[index] = this.nextSample();
    return output;
  }
}
