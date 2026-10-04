import { Actions } from '../state/actions.js';
import { HistoryController } from '../state/history.js';
import { createPatchState, reducePatch } from '../state/patch-state.js';
import { getModuleType, registerModuleType } from '../graph/registry.js';
import { validatePatchGraph } from '../graph/validate.js';
import { CORE_MODULE_DEFINITIONS } from '../modules/core-definitions.js';
import { createModuleElement } from './module-view.js';
import { CableLayer } from './cable-layer.js';

function ensureCoreRegistry() {
  for (const definition of CORE_MODULE_DEFINITIONS) {
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
    ensureCoreRegistry();
    this.root = root;
    this.library = library;
    this.onPatchChange = onPatchChange;
    this.history = new HistoryController(initialPatch);
    this.moduleCounter = Object.keys(initialPatch.modules ?? {}).length;
    this.connectionCounter = initialPatch.connections?.length ?? 0;
    this.pendingPort = null;

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
    for (const raw of CORE_MODULE_DEFINITIONS) {
      const definition = getModuleType(raw.typeId);
      const button = document.createElement('button');
      button.type = 'button';
      button.dataset.moduleType = definition.typeId;
      button.textContent = definition.title;
      button.setAttribute('aria-label', `Add ${definition.title}`);
      button.addEventListener('click', () => this.addModule(definition.typeId));
      list.append(button);
    }
  }

  #nextPosition() {
    const index = Object.keys(this.patch.modules).length;
    return { x: 36 + (index % 4) * 250, y: 36 + Math.floor(index / 4) * 260 };
  }

  addModule(typeId) {
    const definition = getModuleType(typeId);
    const id = `module-${++this.moduleCounter}`;
    this.history.apply(Actions.addModule({ id, type: typeId, scope: definition.defaultScope, position: this.#nextPosition(), parameters: defaultsFor(definition) }));
    this.setStatus(`Added ${definition.title}`);
    this.#changed({ kind: 'topology' });
    return id;
  }

  duplicateModule(moduleId) {
    const source = this.patch.modules[moduleId];
    if (!source) return false;
    const definition = getModuleType(source.type);
    const id = `module-${++this.moduleCounter}`;
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
    this.history.apply(Actions.moveModule(moduleId, { x: Math.max(0, position.x), y: Math.max(0, position.y) }, { historyGroup: `move:${moduleId}` }));
    this.#changed({ kind: 'layout' });
    return true;
  }

  previewParameter(moduleId, parameterId, value) {
    if (!this.patch.modules[moduleId] || !Number.isFinite(value)) return false;
    this.onPatchChange(structuredClone(this.patch), { kind: 'parameter-preview', moduleId, parameterId, value });
    return true;
  }

  setParameter(moduleId, parameterId, value) {
    if (!this.patch.modules[moduleId] || !Number.isFinite(value)) return false;
    this.history.apply(Actions.setParameter(moduleId, parameterId, value, { historyGroup: `parameter:${moduleId}:${parameterId}` }));
    this.setStatus(`Set ${parameterId}`);
    this.#changed({ kind: 'parameter', moduleId, parameterId, value });
    return true;
  }

  handlePort(moduleId, portId, port, element) {
    const candidate = { moduleId, portId, port, element };
    if (!this.pendingPort) {
      this.pendingPort = candidate;
      element.dataset.pending = 'true';
      this.setStatus(`Selected ${port.signalType} ${port.direction} ${portId}`);
      return;
    }
    const first = this.pendingPort;
    first.element?.removeAttribute('data-pending');
    this.pendingPort = null;
    if (first.moduleId === moduleId && first.portId === portId) { this.setStatus('Connection cancelled'); return; }
    const endpoints = normalizedEndpoints(first, candidate);
    if (!endpoints) { this.setStatus('Incompatible ports: connect an output to an input', 'error'); return; }

    const connection = {
      id: `connection-${++this.connectionCounter}`,
      from: { moduleId: endpoints.from.moduleId, portId: endpoints.from.portId },
      to: { moduleId: endpoints.to.moduleId, portId: endpoints.to.portId }
    };
    let proposed;
    try { proposed = reducePatch(this.patch, Actions.addConnection(connection)); }
    catch (error) { this.setStatus(error instanceof Error ? error.message : String(error), 'error'); return; }
    const validation = validatePatchGraph(proposed);
    if (!validation.valid) { this.setStatus(validation.errors[0] ?? 'Incompatible connection', 'error'); return; }
    this.history.apply(Actions.addConnection(connection));
    this.setStatus(`Connected ${connection.from.portId} → ${connection.to.portId}`);
    this.#changed({ kind: 'topology' });
  }

  removeConnection(connectionId) {
    if (!this.patch.connections.some(connection => connection.id === connectionId)) return false;
    this.history.apply(Actions.removeConnection(connectionId));
    this.setStatus('Disconnected cable');
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
        onMove: (moduleId, position) => this.moveModule(moduleId, position),
        onParameterPreview: (moduleId, parameterId, value) => this.previewParameter(moduleId, parameterId, value),
        onParameter: (moduleId, parameterId, value) => this.setParameter(moduleId, parameterId, value)
      }));
    }
    const empty = this.root.querySelector('.empty-state');
    if (empty) empty.hidden = Object.keys(this.patch.modules).length > 0;
    requestAnimationFrame(() => this.cables.render(this.patch.connections));
  }
}
