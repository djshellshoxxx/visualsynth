import { createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function filterVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('filter', 'filter response');
  const cutoff = Math.max(20, Math.min(20000, instance.parameters?.cutoff ?? 12000));
  const normalizedCutoff = Math.log(cutoff / 20) / Math.log(1000);
  const resonance = Math.max(0, Math.min(1, instance.parameters?.resonance ?? 0.1));
  drawNormalizedCurve(canvas, t => {
    const x = Math.max(0.001, t);
    const corner = Math.max(0.02, Math.min(0.98, normalizedCutoff));
    const rolloff = 1 / Math.sqrt(1 + Math.pow(x / corner, 8));
    const bump = resonance * Math.exp(-Math.pow((x - corner) / 0.055, 2)) * 0.45;
    return (rolloff + bump) * 1.7 - 0.85;
  });
  return figure;
}

export function createFilterModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, filterVisual);
}
