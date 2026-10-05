import { bindPredictedVisual, createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function clamp(value, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function distortionVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('distortion', 'distortion transfer curve');
  bindPredictedVisual(canvas, instance.parameters, parameters => {
    const drive = clamp(parameters.drive ?? 3, 1, 20);
    const mix = clamp(parameters.mix ?? 0.7);
    drawNormalizedCurve(canvas, t => {
      const x = t * 2 - 1;
      const wet = Math.tanh(x * drive * 0.75);
      return x * (1 - mix) + wet * mix;
    });
  });
  return figure;
}

function delayVisual(instance, kind) {
  const { figure, canvas } = createPredictedCanvas(kind, `${kind} repeat pattern`);
  bindPredictedVisual(canvas, instance.parameters, parameters => {
    const feedback = clamp(parameters.feedback ?? (kind === 'echo' ? 0.58 : 0.3), 0, 0.92);
    const mix = clamp(parameters.mix ?? (kind === 'echo' ? 0.42 : 0.35));
    const repeats = kind === 'echo' ? 8 : 5;
    drawNormalizedCurve(canvas, t => {
      const position = t * repeats;
      const index = Math.round(position);
      const distance = Math.abs(position - index);
      if (distance > 0.14) return 0;
      const level = index === 0 ? 1 - mix : mix * Math.pow(feedback, Math.max(0, index - 1));
      return level * (1 - distance / 0.14);
    }, 120);
  });
  return figure;
}

export function createDistortionModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, distortionVisual);
}

export function createDelayModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, current => delayVisual(current, 'delay'));
}

export function createEchoModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, current => delayVisual(current, 'echo'));
}
