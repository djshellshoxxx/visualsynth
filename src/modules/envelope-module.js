import { createGenericModuleBody, createPredictedCanvas, drawNormalizedCurve } from './module-ui-helpers.js';

function envelopeVisual(instance) {
  const { figure, canvas } = createPredictedCanvas('adsr', 'ADSR envelope');
  const attack = Math.max(0.001, instance.parameters?.attack ?? 0.01);
  const decay = Math.max(0.001, instance.parameters?.decay ?? 0.15);
  const sustain = Math.max(0, Math.min(1, instance.parameters?.sustain ?? 0.7));
  const release = Math.max(0.001, instance.parameters?.release ?? 0.25);
  const sustainTime = Math.max(0.1, (attack + decay + release) * 0.45);
  const total = attack + decay + sustainTime + release;
  drawNormalizedCurve(canvas, t => {
    const time = t * total;
    let value;
    if (time < attack) value = time / attack;
    else if (time < attack + decay) value = 1 + (sustain - 1) * ((time - attack) / decay);
    else if (time < attack + decay + sustainTime) value = sustain;
    else value = sustain * (1 - (time - attack - decay - sustainTime) / release);
    return value * 2 - 1;
  });
  return figure;
}

export function createEnvelopeModuleBody(instance, definition, handlers) {
  return createGenericModuleBody(instance, definition, handlers, envelopeVisual);
}
