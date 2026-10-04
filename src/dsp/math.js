export const EPSILON = 1e-20;

export function clamp(value, min, max) {
  if (min > max) throw new Error('Invalid clamp range');
  if (!Number.isFinite(value)) return min <= 0 && max >= 0 ? 0 : min;
  return Math.min(max, Math.max(min, value));
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function inverseLerp(a, b, value) {
  if (a === b) return 0;
  return (value - a) / (b - a);
}

export function wrap01(value) {
  if (!Number.isFinite(value)) return 0;
  return value - Math.floor(value);
}

export function onePoleAlpha(timeSeconds, sampleRate) {
  if (!(timeSeconds > 0) || !(sampleRate > 0)) return 1;
  return 1 - Math.exp(-1 / (timeSeconds * sampleRate));
}
