import { createParameterBank } from '../ui/controls.js';

export function createPredictedCanvas(kind, label) {
  const figure = document.createElement('figure');
  figure.className = 'module-visual';
  const canvas = document.createElement('canvas');
  canvas.width = 180;
  canvas.height = 64;
  canvas.dataset.moduleVisual = kind;
  canvas.dataset.visualSource = 'predicted';
  canvas.setAttribute('aria-label', `${label}, predicted`);
  const caption = document.createElement('figcaption');
  caption.dataset.visualSource = 'predicted';
  caption.textContent = `Predicted ${label}`;
  figure.append(canvas, caption);
  return { figure, canvas };
}

export function drawNormalizedCurve(canvas, sampleAt, points = 96) {
  const context = canvas.getContext('2d');
  if (!context) return;
  const width = canvas.width;
  const height = canvas.height;
  context.clearRect(0, 0, width, height);
  context.beginPath();
  for (let i = 0; i < points; i += 1) {
    const t = points <= 1 ? 0 : i / (points - 1);
    const value = Math.max(-1, Math.min(1, Number(sampleAt(t)) || 0));
    const x = t * width;
    const y = height * (0.5 - value * 0.45);
    if (i === 0) context.moveTo(x, y); else context.lineTo(x, y);
  }
  context.stroke();
}

export function createGenericModuleBody(instance, definition, handlers, visualFactory) {
  const body = document.createElement('div');
  body.className = 'module-body';
  if (visualFactory) body.append(visualFactory(instance, definition));
  if (definition.parameters?.length) body.append(createParameterBank(instance, definition, handlers));
  return body;
}
