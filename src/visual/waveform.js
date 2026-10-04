import { sanitizeSample } from '../dsp/safety.js';

export function decimateWaveform(samples, buckets = 128) {
  const source = samples ?? [];
  const count = Math.max(1, Math.min(Math.floor(buckets), source.length || 1));
  if (source.length === 0) return Array.from({ length: count }, () => ({ min: 0, max: 0 }));

  const result = [];
  for (let bucket = 0; bucket < count; bucket += 1) {
    const start = Math.floor(bucket * source.length / count);
    const end = Math.max(start + 1, Math.floor((bucket + 1) * source.length / count));
    let min = 1;
    let max = -1;
    for (let i = start; i < end && i < source.length; i += 1) {
      const value = Math.max(-1, Math.min(1, sanitizeSample(source[i])));
      if (value < min) min = value;
      if (value > max) max = value;
    }
    result.push({ min: min === 1 && max === -1 ? 0 : min, max: max === -1 ? 0 : max });
  }
  return result;
}

export function drawWaveform(canvas, samples) {
  const context = canvas?.getContext?.('2d');
  if (!context) return false;
  const width = canvas.width || canvas.clientWidth || 1;
  const height = canvas.height || canvas.clientHeight || 1;
  const buckets = decimateWaveform(samples, Math.max(1, Math.floor(width)));
  context.clearRect(0, 0, width, height);
  context.beginPath();
  const middle = height / 2;
  for (let x = 0; x < buckets.length; x += 1) {
    const bucket = buckets[x];
    const top = middle - bucket.max * middle;
    const bottom = middle - bucket.min * middle;
    context.moveTo(x + 0.5, top);
    context.lineTo(x + 0.5, bottom);
  }
  context.stroke();
  return true;
}
