import { sanitizeSample } from './safety.js';

const finite = (value, fallback = 0) => (Number.isFinite(value) ? value : fallback);

// Wavefolder: folds the signal back on itself when drive pushes it past +/-1.
export function wavefold(sample, drive = 1, symmetry = 0) {
  let x = finite(sample) * Math.max(0.01, finite(drive, 1)) + finite(symmetry);
  // Triangle fold into [-1, 1]
  x = ((x + 1) % 4 + 4) % 4;
  return sanitizeSample(x < 2 ? x - 1 : 3 - x);
}

// Bit crusher / sample-rate reducer.
export class BitCrusher {
  constructor({ bits = 8, downsample = 1, mix = 1 } = {}) {
    this.set({ bits, downsample, mix });
    this.counter = 0;
    this.held = 0;
  }

  set({ bits, downsample, mix }) {
    this.bits = Math.max(1, Math.min(24, Math.round(finite(bits, 8))));
    this.downsample = Math.max(1, Math.min(64, Math.round(finite(downsample, 1))));
    this.mix = Math.max(0, Math.min(1, finite(mix, 1)));
  }

  processSample(input) {
    const dry = finite(input);
    if (this.counter % this.downsample === 0) {
      const levels = 2 ** (this.bits - 1);
      this.held = Math.round(Math.max(-1, Math.min(1, dry)) * levels) / levels;
    }
    this.counter = (this.counter + 1) % this.downsample;
    return sanitizeSample(dry * (1 - this.mix) + this.held * this.mix);
  }
}

// Slew limiter: bounded rate of change with separate rise/fall times (seconds per unit).
export class SlewLimiter {
  constructor({ sampleRate = 48000, rise = 0.05, fall = 0.05 } = {}) {
    this.sampleRate = sampleRate;
    this.value = 0;
    this.primed = false;
    this.set({ rise, fall });
  }

  set({ rise, fall }) {
    this.rise = Math.max(0, finite(rise, 0.05));
    this.fall = Math.max(0, finite(fall, 0.05));
  }

  processSample(input) {
    const target = finite(input);
    if (!this.primed) { this.value = target; this.primed = true; return this.value; }
    const delta = target - this.value;
    const seconds = delta >= 0 ? this.rise : this.fall;
    const maxStep = seconds <= 0 ? Infinity : 1 / (seconds * this.sampleRate);
    this.value += Math.max(-maxStep, Math.min(maxStep, delta));
    return sanitizeSample(this.value);
  }
}

// Sample & hold: samples `input` on each rising edge of `trigger`; optional slew.
export class SampleAndHold {
  constructor() { this.value = 0; this.lastTrigger = 0; }

  processSample(input, trigger) {
    const t = finite(trigger);
    if (t > 0.5 && this.lastTrigger <= 0.5) this.value = finite(input);
    this.lastTrigger = t;
    return sanitizeSample(this.value);
  }
}

// Comparator with hysteresis. Output: gate (1/0) and trigger on rising edge.
export class Comparator {
  constructor() { this.state = 0; }

  processSample(input, threshold = 0, hysteresis = 0.02) {
    const x = finite(input), h = Math.max(0, finite(hysteresis));
    const previous = this.state;
    if (previous === 0 && x > finite(threshold) + h) this.state = 1;
    else if (previous === 1 && x < finite(threshold) - h) this.state = 0;
    return { gate: this.state, trigger: this.state === 1 && previous === 0 ? 1 : 0 };
  }
}

// Four-pole ladder low-pass (Huovilainen-style, tanh per stage) with resonance feedback.
export class LadderFilter {
  constructor({ sampleRate = 48000, cutoff = 1000, resonance = 0.3, drive = 1 } = {}) {
    this.sampleRate = sampleRate;
    this.stages = [0, 0, 0, 0];
    this.set({ cutoff, resonance, drive });
  }

  set({ cutoff, resonance, drive }) {
    const hz = Math.max(20, Math.min(this.sampleRate * 0.45, finite(cutoff, 1000)));
    this.g = 1 - Math.exp(-2 * Math.PI * hz / this.sampleRate);
    this.k = Math.max(0, Math.min(1, finite(resonance, 0.3))) * 3.9;
    this.drive = Math.max(0.1, Math.min(8, finite(drive, 1)));
  }

  processSample(input) {
    const s = this.stages;
    let x = Math.tanh((finite(input) - this.k * s[3]) * this.drive);
    for (let i = 0; i < 4; i += 1) {
      s[i] += this.g * (Math.tanh(x) - Math.tanh(s[i]));
      x = s[i];
    }
    return sanitizeSample(s[3]);
  }
}

function lcg(seed) {
  let state = (Math.round(finite(seed, 1)) >>> 0) || 1;
  return () => { state = (Math.imul(state, 1664525) + 1013904223) >>> 0; return state / 4294967296; };
}

// Bounded random walk in [-1, 1], stepping on each trigger (or free-running when unpatched).
export class RandomWalk {
  constructor({ seed = 1 } = {}) { this.rand = lcg(seed); this.value = 0; this.lastTrigger = 0; }

  step(stepSize) {
    this.value = Math.max(-1, Math.min(1, this.value + (this.rand() * 2 - 1) * Math.max(0, finite(stepSize, 0.1))));
    return this.value;
  }

  processSample(trigger, stepSize) {
    const t = finite(trigger);
    if (t > 0.5 && this.lastTrigger <= 0.5) this.step(stepSize);
    this.lastTrigger = t;
    return sanitizeSample(this.value);
  }
}

// Logistic-map chaos generator, iterated at `rate` Hz; output scaled to [-1, 1].
export class ChaosGenerator {
  constructor({ sampleRate = 48000, rate = 10, r = 3.9, seed = 1 } = {}) {
    this.sampleRate = sampleRate;
    this.x = 0.1 + 0.8 * lcg(seed)();
    this.phase = 0;
    this.set({ rate, r });
  }

  set({ rate, r }) {
    this.rate = Math.max(0.01, Math.min(this.sampleRate / 2, finite(rate, 10)));
    this.r = Math.max(2.5, Math.min(4, finite(r, 3.9)));
  }

  processSample() {
    this.phase += this.rate / this.sampleRate;
    if (this.phase >= 1) {
      this.phase -= Math.floor(this.phase);
      this.x = this.r * this.x * (1 - this.x);
      if (!(this.x > 1e-6 && this.x < 1 - 1e-6)) this.x = 0.5;
    }
    return sanitizeSample(this.x * 2 - 1);
  }
}
