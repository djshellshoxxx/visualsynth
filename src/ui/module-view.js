import { createGenericModuleBody } from '../modules/module-ui-helpers.js';
import { createOscillatorModuleBody } from '../modules/oscillator-module.js';
import { createMixerModuleBody } from '../modules/mixer-module.js';
import { createFilterModuleBody } from '../modules/filter-module.js';
import { createEnvelopeModuleBody } from '../modules/envelope-module.js';
import { createLfoModuleBody } from '../modules/lfo-module.js';
import { createVcaModuleBody } from '../modules/vca-module.js';
import { createMasterModuleBody } from '../modules/master-module.js';
import { createDistortionModuleBody, createDelayModuleBody, createEchoModuleBody } from '../modules/effect-module.js';
import { moduleHelp, portHelp } from '../help/guidance.js';

const BODY_FACTORIES = Object.freeze({
  'core.oscillator': createOscillatorModuleBody,
  'core.mixer': createMixerModuleBody,
  'core.filter': createFilterModuleBody,
  'core.distortion': createDistortionModuleBody,
  'core.delay': createDelayModuleBody,
  'core.echo': createEchoModuleBody,
  'core.adsr': createEnvelopeModuleBody,
  'core.lfo': createLfoModuleBody,
  'core.vca': createVcaModuleBody,
  'core.master-output': createMasterModuleBody
});

function portLabel(port) {
  return `${port.direction === 'output' ? 'Output' : 'Input'} ${port.label ?? port.id}, ${port.signalType}`;
}

export function createModuleElement(instance, definition, handlers = {}) {
  const card = document.createElement('article');
  card.className = 'module-card';
  card.dataset.moduleId = instance.id;
  card.dataset.moduleType = instance.type;
  card.dataset.x = String(instance.position?.x ?? 0);
  card.dataset.y = String(instance.position?.y ?? 0);
  card.tabIndex = 0;
  card.style.left = `${instance.position?.x ?? 0}px`;
  card.style.top = `${instance.position?.y ?? 0}px`;
  const help = moduleHelp(instance.type);
  card.setAttribute('aria-label', `${definition.title} module`);
  card.setAttribute('aria-description', help);
  card.title = help;

  const header = document.createElement('header');
  header.className = 'module-card-header';
  header.title = `${definition.title}: ${help}`;
  const title = document.createElement('strong');
  title.textContent = definition.title;
  const scope = document.createElement('span');
  scope.textContent = instance.scope;
  scope.title = instance.scope === 'voice' ? 'VOICE scope: one copy runs for each active note.' : 'GLOBAL scope: one shared signal path for the whole patch.';
  header.append(title, scope);
  card.append(header);

  const ports = document.createElement('div');
  ports.className = 'module-ports';
  for (const port of definition.ports) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `module-port module-port-${port.direction}`;
    button.dataset.portId = port.id;
    button.dataset.direction = port.direction;
    button.dataset.signalType = port.signalType;
    button.textContent = port.label ?? port.id;
    const guidance = portHelp(port);
    button.setAttribute('aria-label', `${portLabel(port)} (${port.id})`);
    button.setAttribute('aria-description', guidance);
    button.title = guidance;
    button.addEventListener('click', event => {
      event.stopPropagation();
      handlers.onPort?.(instance.id, port.id, port, button);
    });
    ports.append(button);
  }
  card.append(ports);

  const createBody = BODY_FACTORIES[instance.type] ?? createGenericModuleBody;
  card.append(createBody(instance, definition, handlers));

  const footer = document.createElement('footer');
  footer.className = 'module-card-actions';
  const duplicate = document.createElement('button');
  duplicate.type = 'button';
  duplicate.textContent = 'Duplicate';
  duplicate.title = `Duplicate this ${definition.title} with the same parameter settings.`;
  duplicate.setAttribute('aria-label', `Duplicate ${definition.title}`);
  duplicate.addEventListener('click', event => { event.stopPropagation(); handlers.onDuplicate?.(instance.id); });
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.textContent = 'Remove';
  remove.title = `Remove this ${definition.title} and any cables connected to it.`;
  remove.setAttribute('aria-label', `Remove ${definition.title}`);
  remove.addEventListener('click', event => { event.stopPropagation(); handlers.onRemove?.(instance.id); });
  footer.append(duplicate, remove);
  card.append(footer);

  card.addEventListener('keydown', event => {
    if (event.target !== card) return;
    const step = event.shiftKey ? 48 : 24;
    let dx = 0;
    let dy = 0;
    if (event.key === 'ArrowLeft') dx = -step;
    else if (event.key === 'ArrowRight') dx = step;
    else if (event.key === 'ArrowUp') dy = -step;
    else if (event.key === 'ArrowDown') dy = step;
    else if (event.key === 'Delete' || event.key === 'Backspace') handlers.onRemove?.(instance.id);
    else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'd') handlers.onDuplicate?.(instance.id);
    else return;
    event.preventDefault();
    if (dx || dy) handlers.onMove?.(instance.id, { x: (instance.position?.x ?? 0) + dx, y: (instance.position?.y ?? 0) + dy });
  });

  let drag = null;
  header.addEventListener('pointerdown', event => {
    if (event.button !== 0) return;
    drag = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: instance.position?.x ?? 0,
      y: instance.position?.y ?? 0
    };
    header.setPointerCapture?.(event.pointerId);
    event.preventDefault();
  });
  header.addEventListener('pointermove', event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    card.style.left = `${Math.max(0, drag.x + event.clientX - drag.startX)}px`;
    card.style.top = `${Math.max(0, drag.y + event.clientY - drag.startY)}px`;
  });
  const endDrag = event => {
    if (!drag || drag.pointerId !== event.pointerId) return;
    const position = {
      x: Math.max(0, Math.round(drag.x + event.clientX - drag.startX)),
      y: Math.max(0, Math.round(drag.y + event.clientY - drag.startY))
    };
    drag = null;
    handlers.onMove?.(instance.id, position);
  };
  header.addEventListener('pointerup', endDrag);
  header.addEventListener('pointercancel', () => { drag = null; });

  return card;
}
