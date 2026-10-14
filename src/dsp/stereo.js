import { sanitizeSample } from './safety.js';

const SQRT1_2 = Math.SQRT1_2;

/** Equal-power pan law (DSP_SPEC 14): angle = (pan + 1) * pi/4; centre is -3.01 dB per channel. */
export function panGains(pan) {
  const p = Math.max(-1, Math.min(1, Number.isFinite(pan) ? pan : 0));
  const angle = (p + 1) * Math.PI / 4;
  return { left: Math.cos(angle), right: Math.sin(angle) };
}

/** Mid/side width (DSP_SPEC 28): scale S then decode. width 0 = mono, 1 = unchanged. */
export function applyWidth(left, right, width) {
  const w = Math.max(0, Math.min(4, Number.isFinite(width) ? width : 1));
  const mid = (left + right) * SQRT1_2;
  const side = (left - right) * SQRT1_2 * w;
  return { left: (mid + side) * SQRT1_2, right: (mid - side) * SQRT1_2 };
}

/** Stereo utility: optional mono sum, then width (M/S), then equal-power pan/balance. */
export function stereoUtility(left, right, { pan = 0, width = 1, mono = false } = {}) {
  let l = sanitizeSample(left), r = sanitizeSample(right);
  if (mono) { const m = (l + r) * 0.5; l = m; r = m; }
  else if (width !== 1) ({ left: l, right: r } = applyWidth(l, r, width));
  const g = panGains(pan);
  return { left: sanitizeSample(l * g.left), right: sanitizeSample(r * g.right) };
}
