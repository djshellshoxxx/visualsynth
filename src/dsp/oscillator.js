import { clamp, wrap01 } from './math.js';
import { sanitizeSample } from './safety.js';

export function polyBlep(t, dt) {
  if (!(dt > 0) || dt >= 1) return 0;
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

export function naiveSawSample(phase) {
  return 2 * wrap01(phase) - 1;
}

function sawSample(phase, dt) {
  return naiveSawSample(phase) - polyBlep(phase, dt);
}

function pulseSample(phase, dt, pulseWidth) {
  const width = clamp(pulseWidth, 0.01, 0.99);
  let value = phase < width ? 1 : -1;
  value += polyBlep(phase, dt);
  const shifted = wrap01(phase - width);
  value -= polyBlep(shifted, dt);
  return value;
}

function triangleSample(phase) {
  return 1 - 4 * Math.abs(wrap01(phase) - 0.5);
}

export class Oscillator {
  constructor({ sampleRate = 48000, waveform = 'sine', frequency = 440, phase = 0, pulseWidth = 0.5 } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.waveform = waveform;
    this.phase = wrap01(phase);
    this.subPhase = wrap01(phase * 0.5);
    this.pulseWidth = clamp(pulseWidth, 0.01, 0.99);
    this.setFrequency(frequency);
  }

  setFrequency(frequency) {
    const safe = Number.isFinite(frequency) ? Math.abs(frequency) : 0;
    this.frequency = clamp(safe, 0, this.sampleRate * 0.499);
    return this.frequency;
  }

  reset(phase = 0) {
    this.phase = wrap01(phase);
    this.subPhase = wrap01(phase * 0.5);
  }

  nextSample() {
    const dt = this.frequency / this.sampleRate;
    const phase = this.phase;
    let value;

    switch (this.waveform) {
      case 'triangle': value = triangleSample(phase); break;
      case 'saw': value = sawSample(phase, dt); break;
      case 'reverse-saw': value = -sawSample(phase, dt); break;
      case 'square': value = pulseSample(phase, dt, 0.5); break;
      case 'pulse': value = pulseSample(phase, dt, this.pulseWidth); break;
      case 'sub': value = pulseSample(this.subPhase, dt * 0.5, 0.5); break;
      case 'sine':
      default: value = Math.sin(2 * Math.PI * phase); break;
    }

    this.phase = wrap01(phase + dt);
    this.subPhase = wrap01(this.subPhase + dt * 0.5);
    return sanitizeSample(value);
  }

  renderBlock(length) {
    const output = new Float32Array(Math.max(0, Math.floor(length)));
    for (let i = 0; i < output.length; i += 1) output[i] = this.nextSample();
    return output;
  }
}
