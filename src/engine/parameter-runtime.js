import { clamp, onePoleAlpha } from '../dsp/math.js';
import { sanitizeSample } from '../dsp/safety.js';

function normalized(value) {
  return clamp(Number.isFinite(value) ? value : 0, 0, 1);
}

export function normalizedToParameterValue(definition, value) {
  const t = normalized(value);
  const min = definition.min;
  const max = definition.max;

  if (definition.curve === 'log' && min > 0 && max > min) {
    return min * ((max / min) ** t);
  }

  if (definition.curve === 'integer' || definition.curve === 'choice') {
    return Math.round(min + (max - min) * t);
  }

  return min + (max - min) * t;
}

export function parameterValueToNormalized(definition, value) {
  const bounded = clamp(sanitizeSample(value), definition.min, definition.max);

  if (definition.curve === 'log' && definition.min > 0 && definition.max > definition.min) {
    return Math.log(bounded / definition.min) / Math.log(definition.max / definition.min);
  }

  if (definition.max === definition.min) return 0;
  return (bounded - definition.min) / (definition.max - definition.min);
}

export class ParameterRuntime {
  constructor(definition, sampleRate, initialValue = definition.defaultValue) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.definition = definition;
    this.sampleRate = sampleRate;
    this.current = this.#sanitizeTarget(initialValue);
    this.target = this.current;
    this.events = [];
    this.alpha = onePoleAlpha((definition.smoothingMs ?? 0) / 1000, sampleRate);
  }

  #sanitizeTarget(value) {
    const finite = Number.isFinite(value) ? value : 0;
    return clamp(finite, this.definition.min, this.definition.max);
  }

  setTarget(id, value, frame = 0) {
    if (id !== this.definition.id) return false;
    const safeFrame = Number.isFinite(frame) ? Math.max(0, Math.floor(frame)) : 0;
    this.events.push({ frame: safeFrame, value: this.#sanitizeTarget(value) });
    this.events.sort((a, b) => a.frame - b.frame);
    return true;
  }

  #applyEventsAt(frame) {
    while (this.events.length && this.events[0].frame <= frame) {
      const event = this.events.shift();
      this.target = event.value;
      if ((this.definition.smoothingMs ?? 0) <= 0) this.current = this.target;
    }
  }

  #renderSample(frame) {
    this.#applyEventsAt(frame);
    if ((this.definition.smoothingMs ?? 0) > 0) {
      this.current += this.alpha * (this.target - this.current);
    }
    this.current = this.#sanitizeTarget(sanitizeSample(this.current));
    return this.current;
  }

  renderBlock(startFrame, blockLength) {
    const length = Math.max(0, Math.floor(blockLength));
    const output = new Float32Array(length);
    for (let i = 0; i < length; i += 1) {
      output[i] = this.#renderSample(startFrame + i);
    }
    return output;
  }

  snapshot() {
    return Object.freeze({
      id: this.definition.id,
      current: this.current,
      target: this.target,
      queuedEvents: this.events.length
    });
  }
}
