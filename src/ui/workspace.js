import { Actions } from '../state/actions.js';
import { HistoryController } from '../state/history.js';
import { createPatchState, reducePatch } from '../state/patch-state.js';
import { getModuleType, registerModuleType } from '../graph/registry.js';
import { validatePatchGraph } from '../graph/validate.js';
import { AVAILABLE_MODULE_DEFINITIONS } from '../modules/available-definitions.js';
import { moduleHelp, portHelp, wiringMismatchHelp } from '../help/guidance.js';
import { createModuleElement } from './module-view.js';
import { CableLayer } from './cable-layer.js';

function ensureAvailableRegistry() {
  for (const definition of AVAILABLE_MODULE_DEFINITIONS) {
    try { getModuleType(definition.typeId); } catch { registerModuleType(definition); }
  }
}

function defaultsFor(definition) {
  return Object.fromEntries((definition.parameters ?? []).map(parameter => [parameter.id, parameter.defaultValue]));
}

function normalizedEndpoints(a, b) {
  if (a.port.direction === 'output' && b.port.direction === 'input') return { from: a, to: b };
  if (b.port.direction === 'output' && a.port.direction === 'input') return { from: b, to: a };
  return null;
}

export class WorkspaceController {
  constructor({ root, library, onPatchChange = () => {}, initialPatch = createPatchState() } = {}) {
    if (!root) throw new Error('Workspace root is required');
    if (!library) throw new Error('Module library root is required');
    ensureAvailableRegistry();
    this.root = root;
    this.library = library;
    this.onPatchChange = onPatchChange;
    this.history = new HistoryController(initialPatch);
    this.moduleCounter = Object.keys(initialPatch.modules ?? {}).length;
    this.connectionCounter = initialPatch.connections?.length ?? 0;
    this.pendingPort = null;
    this.spawnOffset = 0;
    this.cableFrame = null;

    this.stage = document.createElement('div');
    this.stage.className = 'workspace-stage';
    this.root.append(this.stage);

    this.status = document.createElement('div');
    this.status.id = 'workspace-status';
    this.status.className = 'workspace-status';
    this.status.setAttribute('role', 'status');
    this.status.setAttribute('aria-live', 'polite');
    this.root.append(this.status);

    this.cables = new CableLayer(this.root, { onRemove: id => this.removeConnection(id) });
    this.resizeObserver = new ResizeObserver(() => this.#scheduleCables());
    this.resizeObserver.observe(this.root);
    this.root.addEventListener('scroll', () => this.#scheduleCables(), { passive: true });
    this.renderLibrary();
    this.render();
  }

  get patch() { return this.history.state; }

  setStatus(message, kind = 'info') {
    this.status.textContent = message;
    this.status.dataset.kind = kind;
  }

  renderLibrary() {
    this.library.querySelector('.module-placeholder-list')?.remove();
    let list = this.library.querySelector('.module-library-list');
    if (!list) {
      list = document.createElement('div');
      list.className = 'module-library-list';
      this.library.append(list);
    }
    list.replaceChildren();
    for (const raw of AVAILABLE_MODULE_DEFINITIONS) {
      const definition = getModuleType(raw.typeId);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.moduleType = definition.typeId;
      button.textContent = definition.title;
      const guidance = moduleHelp(definition.typeId);
      button.title = `Add ${definition.title}. ${guidance}`;
      button.setAttribute('aria-label', `Add ${definition.title}`);
      button.setAttribute('aria-description', guidance);
      button.addEventListener('click', () => this.addModule(definition.typeId));
      list.append(button);
    }
  }

  #nextPosition() {
    let rect = this.root.getBoundingClientRect();
    if (rect.top >= window.innerHeight || rect.bottom <= 0) {
      this.root.scrollIntoView({ block: 'nearest' });
      rect = this.root.getBoundingClientRect();
    }
    const left = this.root.scrollLeft + 24;
    const top = this.root.scrollTop + Math.max(0, -rect.top) + 24;
    const right = this.root.scrollLeft + this.root.clientWidth - 214;
    const cards = [...this.stage.querySelectorAll('.module-card')];
    for (let x = left; x <= right; x += 214) {
      if (!cards.some(card => x < card.offsetLeft + card.offsetWidth && x + 190 > card.offsetLeft && top < card.offsetTop + card.offsetHeight && top + 38 > card.offsetTop)) return { x, y: top };
    }
    // A crowded viewport still gets a reachable header, rather than a new offscreen row.
    const offset = (this.spawnOffset++ % 4) * 16;
    return { x: Math.max(this.root.scrollLeft, Math.min(left + offset, right)), y: top + offset };
  }

  #scheduleCables() {
    if (this.cableFrame !== null) return;
    this.cableFrame = requestAnimationFrame(() => {
      this.cableFrame = null;
      let width = Math.max(1200, this.root.scrollLeft + this.root.clientWidth);
      let height = Math.max(800, this.root.scrollTop + this.root.clientHeight);
      for (const card of this.stage.children) {
        width = Math.max(width, card.offsetLeft + card.offsetWidth + 80);
        height = Math.max(height, card.offsetTop + card.offsetHeight + 80);
      }
      for (const surface of [this.stage, this.cables.svg, this.root.querySelector('.workspace-grid')]) {
        if (!surface) continue;
        surface.style.width = `${width}px`;
        surface.style.height = `${height}px`;
      }
      this.cables.render(this.patch.connections);
    });
  }

  addModule(typeId) {
    const definition = getModuleType(typeId);
    let id;
    do { id = `module-${++this.moduleCounter}`; } while (Object.hasOwn(this.patch.modules, id));
    this.history.apply(Actions.addModule({ id, type: typeId, scope: definition.defaultScope, position: this.#nextPosition(), parameters: defaultsFor(definition) }));
    this.setStatus(`Added ${definition.title}. ${moduleHelp(typeId)}`);
    this.#changed({ kind: 'topology' });
    this.stage.querySelector(`[data-module-id="${CSS.escape(id)}"]`)?.focus({ preventScroll: true });
    return id;
  }

  duplicateModule(moduleId) {
    const source = this.patch.modules[moduleId];
    if (!source) return false;
    const definition = getModuleType(source.type);
    let id;
    do { id = `module-${++this.moduleCounter}`; } while (Object.hasOwn(this.patch.modules, id));
    this.history.apply(Actions.duplicateModule(moduleId, id, { x: (source.position?.x ?? 0) + 32, y: (source.position?.y ?? 0) + 32 }));
    this.setStatus(`Duplicated ${definition.title}`);
    this.#changed({ kind: 'topology' });
    return true;
  }

  removeModule(moduleId) {
    const source = this.patch.modules[moduleId];
    if (!source) return false;
    const definition = getModuleType(source.type);
    this.history.apply(Actions.removeModule(moduleId));
    if (this.pendingPort?.moduleId === moduleId) this.pendingPort = null;
    this.setStatus(`Removed ${definition.title}`);
    this.#changed({ kind: 'topology' });
    return true;
  }

  moveModule(moduleId, position) {
    if (!this.patch.modules[moduleId]) return false;
    this.history.apply(Actions.moveModule(moduleId, { x: Math.max(0, position.x), y: Math.max(0, position.y) }));
    const card = this.stage.querySelector(`[data-module-id="${CSS.escape(moduleId)}"]`);
    if (card) {
      card.style.left = `${Math.max(0, position.x)}px`;
      card.style.top = `${Math.max(0, position.y)}px`;
      card.dataset.x = String(Math.max(0, position.x));
      card.dataset.y = String(Math.max(0, position.y));
    }
    this.#changed({ kind: 'layout' });
    return true;
  }

  #refreshModuleVisual(moduleId, parameterId, value) {
    const instance = this.patch.modules[moduleId];
    if (!instance) return;
    const parameters = { ...(instance.parameters ?? {}), [parameterId]: value };
    const card = this.stage.querySelector(`[data-module-id="${CSS.escape(moduleId)}"]`);
    if (!card) return;
    for (const canvas of card.querySelectorAll('canvas[data-module-visual]')) {
      if (typeof canvas.visualSynthRefresh === 'function') canvas.visualSynthRefresh(parameters);
    }
  }

  previewParameter(moduleId, parameterId, value) {
    if (!this.patch.modules[moduleId] || !Number.isFinite(value)) return false;
    this.#refreshModuleVisual(moduleId, parameterId, value);
    this.onPatchChange(structuredClone(this.patch), { kind: 'parameter-preview', moduleId, parameterId, value });
    return true;
  }

  setParameter(moduleId, parameterId, value) {
    if (!this.patch.modules[moduleId] || !Number.isFinite(value)) return false;
    this.history.apply(Actions.setParameter(moduleId, parameterId, value));
    this.#refreshModuleVisual(moduleId, parameterId, value);
    this.setStatus(`Set ${parameterId}`);
    this.#changed({ kind: 'parameter', moduleId, parameterId, value });
    return true;
  }

  handlePort(moduleId, portId, port, element) {
    const candidate = { moduleId, portId, port, element };
    if (!this.pendingPort) {
      this.pendingPort = candidate;
      element.dataset.pending = 'true';
      this.setStatus(`Selected ${String(port.signalType).toUpperCase()} ${port.direction} ${portId}. ${portHelp(port)}`);
      return;
    }
    const first = this.pendingPort;
    first.element?.removeAttribute('data-pending');
    this.pendingPort = null;
    if (first.moduleId === moduleId && first.portId === portId) { this.setStatus('Connection cancelled'); return; }
    const endpoints = normalizedEndpoints(first, candidate);
    if (!endpoints) { this.setStatus(wiringMismatchHelp(first.port, candidate.port), 'error'); return; }

    let connectionId;
    do { connectionId = `connection-${++this.connectionCounter}`; } while (this.patch.connections.some(edge => edge.id === connectionId));
    const connection = {
      id: connectionId,
      from: { moduleId: endpoints.from.moduleId, portId: endpoints.from.portId },
      to: { moduleId: endpoints.to.moduleId, portId: endpoints.to.portId }
    };
    let proposed;
    try { proposed = reducePatch(this.patch, Actions.addConnection(connection)); }
    catch (error) { this.setStatus(error instanceof Error ? error.message : String(error), 'error'); return; }
    const validation = validatePatchGraph(proposed);
    if (!validation.valid) {
      const primary = validation.errors[0] ?? 'Incompatible connection';
      this.setStatus(`${primary}. ${wiringMismatchHelp(endpoints.from.port, endpoints.to.port)}`, 'error');
      return;
    }
    this.history.apply(Actions.addConnection(connection));
    this.setStatus(`Connected ${connection.from.portId} → ${connection.to.portId}. Signal path is valid.`);
    this.#changed({ kind: 'topology' });
  }

  removeConnection(connectionId) {
    if (!this.patch.connections.some(connection => connection.id === connectionId)) return false;
    this.history.apply(Actions.removeConnection(connectionId));
    this.setStatus('Disconnected cable');
    this.#changed({ kind: 'topology' });
    return true;
  }

  replacePatch(patch, status = 'Loaded patch') {
    const validation = validatePatchGraph(patch);
    if (!validation.valid) {
      this.setStatus(validation.errors[0] ?? 'Invalid patch', 'error');
      return false;
    }
    this.history = new HistoryController(structuredClone(patch));
    this.moduleCounter = Object.keys(patch.modules ?? {}).length;
    this.connectionCounter = patch.connections?.length ?? 0;
    this.pendingPort = null;
    this.setStatus(status);
    this.#changed({ kind: 'topology' });
    return true;
  }

  undo() {
    if (!this.history.undo()) return false;
    this.setStatus('Undo');
    this.#changed({ kind: 'history' });
    return true;
  }

  redo() {
    if (!this.history.redo()) return false;
    this.setStatus('Redo');
    this.#changed({ kind: 'history' });
    return true;
  }

  #changed(meta = { kind: 'topology' }) {
    if (meta.kind === 'parameter' || meta.kind === 'parameter-preview') {
      this.onPatchChange(structuredClone(this.patch), meta);
      return;
    }
    if (meta.kind === 'layout') {
      this.#scheduleCables();
      this.onPatchChange(structuredClone(this.patch), meta);
      return;
    }
    this.render();
    this.onPatchChange(structuredClone(this.patch), meta);
  }

  render() {
    this.stage.replaceChildren();
    for (const instance of Object.values(this.patch.modules)) {
      const definition = getModuleType(instance.type);
      this.stage.append(createModuleElement(instance, definition, {
        onPort: (moduleId, portId, port, element) => this.handlePort(moduleId, portId, port, element),
        onDuplicate: moduleId => this.duplicateModule(moduleId),
        onRemove: moduleId => this.removeModule(moduleId),
        onMovePreview: () => this.#scheduleCables(),
        onMove: (moduleId, position) => this.moveModule(moduleId, position),
        onParameterPreview: (moduleId, parameterId, value) => this.previewParameter(moduleId, parameterId, value),
        onParameter: (moduleId, parameterId, value) => this.setParameter(moduleId, parameterId, value)
      }));
    }
    const empty = this.root.querySelector('.empty-state');
    if (empty) empty.hidden = Object.keys(this.patch.modules).length > 0;
    this.#scheduleCables();
  }
}
