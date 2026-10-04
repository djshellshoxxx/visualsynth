import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export function equalPowerPan(pan) {
  const p = clamp(pan, -1, 1);
  const angle = (p + 1) * Math.PI / 4;
  return { left: Math.cos(angle), right: Math.sin(angle) };
}

export function mixSample(inputs = []) {
  let left = 0;
  let right = 0;
  for (const input of inputs) {
    if (input?.mute) continue;
    const sample = sanitizeSample(input?.sample ?? 0);
    const level = clamp(Number.isFinite(input?.level) ? input.level : 1, 0, 8);
    const polarity = input?.polarity === -1 ? -1 : 1;
    const pan = equalPowerPan(input?.pan ?? 0);
    const value = sample * level * polarity;
    left += value * pan.left;
    right += value * pan.right;
  }
  return { left: sanitizeSample(left), right: sanitizeSample(right) };
}
