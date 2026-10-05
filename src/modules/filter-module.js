import { bindPredictedVisual, createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function filterVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('filter', 'filter response');
  bindPredictedVisual(canvas, instance.parameters, parameters => {
    const cutoff = Math.max(20, Math.min(20000, parameters.cutoff ?? 12000));
    const corner = Math.max(0.02, Math.min(0.98, Math.log(cutoff / 20) / Math.log(1000)));
    const resonance = Math.max(0, Math.min(1, parameters.resonance ?? 0.1));
    const mode = Math.round(parameters.mode ?? 0);
    drawNormalizedCurve(canvas, t => {
      const x = Math.max(0.001, t);
      const low = 1 / Math.sqrt(1 + Math.pow(x / corner, 8));
      const high = 1 / Math.sqrt(1 + Math.pow(corner / x, 8));
      const width = Math.max(0.035, 0.15 - resonance * 0.08);
      const band = Math.exp(-Math.pow((x - corner) / width, 2));
      const bump = resonance * Math.exp(-Math.pow((x - corner) / 0.055, 2)) * 0.35;
      let response;
      if (mode === 1) response = high + bump;
      else if (mode === 2) response = band + bump;
      else if (mode === 3) response = 1 - band * 0.9 + bump * 0.3;
      else response = low + bump;
      return Math.max(-1, Math.min(1, response * 1.7 - 0.85));
    });
  });
  return figure;
}

export function createFilterModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, filterVisual);
}
