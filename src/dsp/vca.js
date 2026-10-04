import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export function applyVca(input, gain, { maxGain = 8, bipolar = false } = {}) {
  const x = sanitizeSample(input);
  const limit = Number.isFinite(maxGain) && maxGain > 0 ? maxGain : 8;
  const safeGain = Number.isFinite(gain) ? gain : 0;
  const boundedGain = bipolar ? clamp(safeGain, -limit, limit) : clamp(safeGain, 0, limit);
  return sanitizeSample(x * boundedGain);
}
