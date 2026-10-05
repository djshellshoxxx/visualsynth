import { bindPredictedVisual, createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function oscillatorVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('oscillator', 'source waveform');
  bindPredictedVisual(canvas, instance.parameters, parameters => {
    const waveformIndex = Math.round(parameters.waveform ?? 2);
    const pulseWidth = Math.max(0.02, Math.min(0.98, parameters.pulseWidth ?? 0.5));
    drawNormalizedCurve(canvas, t => {
      switch (waveformIndex) {
        case 0: return Math.sin(2 * Math.PI * t);
        case 1: return 1 - 4 * Math.abs(t - 0.5);
        case 3: return 1 - 2 * t;
        case 4: return t < 0.5 ? 1 : -1;
        case 5: return t < pulseWidth ? 1 : -1;
        case 2:
        default: return 2 * t - 1;
      }
    });
  });
  return figure;
}

export function createOscillatorModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, oscillatorVisual);
}
