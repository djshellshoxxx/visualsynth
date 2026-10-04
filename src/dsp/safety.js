import { clamp as clampValue, EPSILON } from './math.js';

export const DEFAULT_GAIN_LIMIT = 8;
export const DB_FLOOR = -160;

export function sanitizeSample(value) {
  if (!Number.isFinite(value)) return 0;
  if (Math.abs(value) < EPSILON) return 0;
  return value;
}

export function clamp(value, min, max) {
  return clampValue(sanitizeSample(value), min, max);
}

export function safeGain(value, limit = DEFAULT_GAIN_LIMIT) {
  const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : DEFAULT_GAIN_LIMIT;
  return clamp(sanitizeSample(value), -safeLimit, safeLimit);
}

export function dbToGain(db) {
  const safeDb = clamp(db, DB_FLOOR, 60);
  return sanitizeSample(10 ** (safeDb / 20));
}

export function gainToDb(gain) {
  const safe = Math.max(Math.abs(sanitizeSample(gain)), 10 ** (DB_FLOOR / 20));
  return 20 * Math.log10(safe);
}
