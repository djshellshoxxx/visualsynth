import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export const EnvelopeStage = Object.freeze({ IDLE: 'idle', ATTACK: 'attack', DECAY: 'decay', SUSTAIN: 'sustain', RELEASE: 'release' });

export class ADSREnvelope {
  constructor({ sampleRate = 48000, attack = 0.01, decay = 0.15, sustain = 0.7, release = 0.25 } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.attack = Math.max(0, attack);
    this.decay = Math.max(0, decay);
    this.sustain = clamp(sustain, 0, 1);
    this.release = Math.max(0, release);
    this.value = 0;
    this.stage = EnvelopeStage.IDLE;
    this.stageSample = 0;
    this.releaseStart = 0;
  }

  gateOn(policy = 'reset') {
    if (policy === 'reset') this.value = 0;
    this.stage = EnvelopeStage.ATTACK;
    this.stageSample = 0;
  }

  gateOff() {
    this.releaseStart = this.value;
    this.stage = EnvelopeStage.RELEASE;
    this.stageSample = 0;
  }

  #samples(seconds) {
    return Math.max(0, Math.round(seconds * this.sampleRate));
  }

  nextSample() {
    for (let guard = 0; guard < 5; guard += 1) {
      if (this.stage === EnvelopeStage.IDLE) return 0;
      if (this.stage === EnvelopeStage.SUSTAIN) return this.sustain;

      if (this.stage === EnvelopeStage.ATTACK) {
        const total = this.#samples(this.attack);
        if (total === 0) {
          this.value = 1;
          this.stage = EnvelopeStage.DECAY;
          this.stageSample = 0;
          continue;
        }
        this.stageSample += 1;
        this.value = clamp(this.stageSample / total, 0, 1);
        if (this.stageSample >= total) {
          this.value = 1;
          this.stage = EnvelopeStage.DECAY;
          this.stageSample = 0;
        }
        return sanitizeSample(this.value);
      }

      if (this.stage === EnvelopeStage.DECAY) {
        const total = this.#samples(this.decay);
        if (total === 0) {
          this.value = this.sustain;
          this.stage = EnvelopeStage.SUSTAIN;
          continue;
        }
        this.stageSample += 1;
        const t = clamp(this.stageSample / total, 0, 1);
        this.value = 1 + (this.sustain - 1) * t;
        if (this.stageSample >= total) {
          this.value = this.sustain;
          this.stage = EnvelopeStage.SUSTAIN;
          this.stageSample = 0;
        }
        return sanitizeSample(this.value);
      }

      if (this.stage === EnvelopeStage.RELEASE) {
        const total = this.#samples(this.release);
        if (total === 0) {
          this.value = 0;
          this.stage = EnvelopeStage.IDLE;
          return 0;
        }
        this.stageSample += 1;
        const t = clamp(this.stageSample / total, 0, 1);
        this.value = this.releaseStart * (1 - t);
        if (this.stageSample >= total) {
          this.value = 0;
          this.stage = EnvelopeStage.IDLE;
          this.stageSample = 0;
        }
        return sanitizeSample(this.value);
      }
    }
    this.value = 0;
    this.stage = EnvelopeStage.IDLE;
    return 0;
  }

  renderBlock(length) {
    const output = new Float32Array(Math.max(0, Math.floor(length)));
    for (let i = 0; i < output.length; i += 1) output[i] = this.nextSample();
    return output;
  }
}
