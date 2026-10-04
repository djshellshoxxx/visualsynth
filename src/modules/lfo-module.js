import { createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function lfoVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('lfo', 'LFO waveform');
  const amount = Math.max(0, Math.min(1, instance.parameters?.amount ?? 1));
  drawNormalizedCurve(canvas, t => Math.sin(2 * Math.PI * t) * amount);
  return figure;
}

export function createLfoModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, lfoVisual);
}
