import { sanitizeSample } from '../dsp/safety.js';

export function spectrumMagnitudes(samples, bins = 64) {
  const source = samples ?? [];
  const count = Math.max(1, Math.min(Math.floor(bins), Math.max(1, Math.floor(source.length / 2))));
  const output = new Float32Array(count);
  if (source.length === 0) return output;

  let peak = 0;
  for (let k = 0; k < count; k += 1) {
    let real = 0;
    let imaginary = 0;
    for (let n = 0; n < source.length; n += 1) {
      const value = sanitizeSample(source[n]);
      const angle = -2 * Math.PI * k * n / source.length;
      real += value * Math.cos(angle);
      imaginary += value * Math.sin(angle);
    }
    const magnitude = Math.sqrt(real * real + imaginary * imaginary) / source.length * 2;
    output[k] = Number.isFinite(magnitude) ? magnitude : 0;
    peak = Math.max(peak, output[k]);
  }
  if (peak > 1) {
    for (let i = 0; i < output.length; i += 1) output[i] /= peak;
  }
  return output;
}

export function drawSpectrum(canvas, magnitudes) {
  const context = canvas?.getContext?.('2d');
  if (!context) return false;
  const width = canvas.width || canvas.clientWidth || 1;
  const height = canvas.height || canvas.clientHeight || 1;
  context.clearRect(0, 0, width, height);
  const values = magnitudes ?? [];
  if (values.length === 0) return true;
  const barWidth = width / values.length;
  for (let i = 0; i < values.length; i += 1) {
    const value = Math.max(0, Math.min(1, sanitizeSample(values[i])));
    context.fillRect(i * barWidth, height * (1 - value), Math.max(1, barWidth - 1), height * value);
  }
  return true;
}
