import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export class DistortionEffect {
  constructor({ drive = 2, tone = 0.65, mix = 1 } = {}) { this.low = 0; this.setDrive(drive); this.setTone(tone); this.setMix(mix); }
  setDrive(value) { this.drive = clamp(Number.isFinite(value) ? value : 2, 1, 20); }
  setTone(value) { this.tone = clamp(Number.isFinite(value) ? value : 0.65, 0, 1); }
  setMix(value) { this.mix = clamp(Number.isFinite(value) ? value : 1, 0, 1); }
  processSample(input) {
    const dry = sanitizeSample(input); const shaped = Math.tanh(dry * this.drive);
    this.low += (shaped - this.low) * (0.02 + this.tone * 0.45);
    const wet = this.tone < 0.5 ? this.low : shaped * (this.tone * 2 - 1) + this.low * (2 - this.tone * 2);
    return sanitizeSample(dry * (1 - this.mix) + wet * this.mix);
  }
}

export class DelayEffect {
  constructor({ sampleRate = 48000, time = 0.25, feedback = 0.3, mix = 0.35, damping = 0.25 } = {}) {
    this.sampleRate = sampleRate; this.buffer = new Float32Array(Math.ceil(sampleRate * 2.05)); this.writeIndex = 0; this.filteredFeedback = 0;
    this.setTime(time); this.setFeedback(feedback); this.setMix(mix); this.setDamping(damping);
  }
  setTime(value) { this.time = clamp(Number.isFinite(value) ? value : 0.25, 0.005, 2); }
  setFeedback(value) { this.feedback = clamp(Number.isFinite(value) ? value : 0.3, 0, 0.92); }
  setMix(value) { this.mix = clamp(Number.isFinite(value) ? value : 0.35, 0, 1); }
  setDamping(value) { this.damping = clamp(Number.isFinite(value) ? value : 0.25, 0, 1); }
  processSample(input) {
    const dry = sanitizeSample(input);
    const delaySamples = Math.max(1, Math.min(this.buffer.length - 1, Math.round(this.time * this.sampleRate)));
    const readIndex = (this.writeIndex - delaySamples + this.buffer.length) % this.buffer.length;
    const delayed = this.buffer[readIndex];
    this.filteredFeedback += (delayed - this.filteredFeedback) * (1 - this.damping * 0.96);
    this.buffer[this.writeIndex] = sanitizeSample(dry + this.filteredFeedback * this.feedback);
    this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
    return sanitizeSample(dry * (1 - this.mix) + delayed * this.mix);
  }
}

export class EchoEffect extends DelayEffect {
  constructor(options = {}) { super({ time: 0.36, feedback: 0.58, mix: 0.42, damping: 0.42, ...options }); }
}
