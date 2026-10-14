import { sanitizeSample } from './safety.js';

export const VOICE_REDUCE_MODES = Object.freeze(['mean', 'max', 'min', 'sum', 'latest', 'selected']);

// Reduce per-voice control lanes to one global value (VOICE-006).
export function reduceVoiceValues(values, mode = 'mean') {
  const list = values.map(value => (Number.isFinite(value) ? value : 0));
  if (!list.length) return 0;
  switch (mode) {
    case 'max': return sanitizeSample(Math.max(...list));
    case 'min': return sanitizeSample(Math.min(...list));
    case 'sum': return sanitizeSample(list.reduce((a, b) => a + b, 0));
    case 'latest': return sanitizeSample(list[list.length - 1]);
    case 'selected': return sanitizeSample(list[0]);
    default: return sanitizeSample(list.reduce((a, b) => a + b, 0) / list.length);
  }
}

// Attack/release envelope follower for the Envelope Follower module.
export class EnvelopeFollower {
  constructor({ sampleRate = 48000, attack = 0.01, release = 0.1 } = {}) {
    this.sampleRate = sampleRate;
    this.level = 0;
    this.setTimes(attack, release);
  }

  setTimes(attack, release) {
    const coeff = seconds => Math.exp(-1 / Math.max(1, Math.max(0.0001, seconds) * this.sampleRate));
    this.attackCoeff = coeff(attack);
    this.releaseCoeff = coeff(release);
  }

  processSample(input) {
    const rectified = Math.abs(Number.isFinite(input) ? input : 0);
    const coeff = rectified > this.level ? this.attackCoeff : this.releaseCoeff;
    this.level = rectified + coeff * (this.level - rectified);
    return sanitizeSample(this.level);
  }
}
