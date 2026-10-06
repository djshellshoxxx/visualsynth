import { getModuleType } from '../graph/registry.js';
import { validatePatchGraph } from '../graph/validate.js';
import { createPatchState } from '../state/patch-state.js';
import { CURRENT_PATCH_SCHEMA_VERSION, migratePatch, PATCH_FORMAT } from './migrations.js';

const MAX_PATCH_BYTES = 10 * 1024 * 1024;

function assertFiniteTree(value, label = 'value') {
  if (typeof value === 'number' && !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  if (Array.isArray(value)) {
    value.forEach((entry, index) => assertFiniteTree(entry, `${label}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) assertFiniteTree(entry, `${label}.${key}`);
  }
}

function sortedObject(object = {}) {
  return Object.fromEntries(Object.entries(object).sort(([a], [b]) => a.localeCompare(b)));
}

function serializeModule(module) {
  if (module.type === 'system.unknown-placeholder' && module.state?.originalModule) {
    return { ...structuredClone(module.state.originalModule), enabled: false };
  }
  return {
    id: module.id,
    type: module.type,
    moduleVersion: module.moduleVersion ?? 1,
    name: module.name ?? module.id,
    scope: module.scope,
    enabled: module.enabled ?? true,
    bypass: module.bypass ?? false,
    muted: module.muted ?? false,
    parameters: sortedObject(structuredClone(module.parameters ?? {})),
    state: structuredClone(module.state ?? {}),
    ui: {
      x: Number.isFinite(module.position?.x) ? module.position.x : 0,
      y: Number.isFinite(module.position?.y) ? module.position.y : 0,
      ...(module.ui ?? {})
    }
  };
}

function serializeConnection(connection) {
  return {
    id: connection.id,
    source: structuredClone(connection.source ?? connection.from),
    destination: structuredClone(connection.destination ?? connection.to),
    ...(connection.signal ? { signal: connection.signal } : {}),
    enabled: connection.enabled ?? true,
    ...(connection.ui ? { ui: structuredClone(connection.ui) } : {})
  };
}

function toDocument(patch) {
  const modules = Object.values(patch.modules ?? {})
    .map(serializeModule)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const connections = [...(patch.connections ?? [])]
    .map(serializeConnection)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
  const description = patch.description ?? patch.settings?.description ?? '';

  return {
    format: PATCH_FORMAT,
    schemaVersion: CURRENT_PATCH_SCHEMA_VERSION,
    appVersion: '0.1.0',
    id: patch.id ?? 'patch_local',
    name: patch.name ?? 'Untitled Patch',
    description,
    tags: Array.isArray(patch.tags) ? [...patch.tags].sort() : [],
    settings: structuredClone(patch.settings ?? {}),
    transport: structuredClone(patch.transport ?? {}),
    modules,
    connections,
    modulations: structuredClone(patch.modulations ?? []),
    automation: structuredClone(patch.automation ?? []),
    probes: structuredClone(patch.probes ?? []),
    midiMappings: structuredClone(patch.midiMappings ?? []),
    performanceView: structuredClone(patch.performanceView ?? {}),
    ui: structuredClone(patch.ui ?? {}),
    extensions: structuredClone(patch.extensions ?? {})
  };
}

function validateModule(module) {
  if (!module || typeof module !== 'object' || Array.isArray(module)) throw new Error('Patch module must be an object');
  if (!module.id || typeof module.id !== 'string') throw new Error('Patch module requires a string id');
  if (!module.type || typeof module.type !== 'string') throw new Error(`Module ${module.id} requires a type`);
  let definition;
  try { definition = getModuleType(module.type); }
  catch { return { unknown: true }; }
  if (!definition.allowedScopes.includes(module.scope)) throw new Error(`Module ${module.id} has invalid scope ${module.scope}`);

  const knownParameters = new Map((definition.parameters ?? []).map(parameter => [parameter.id, parameter]));
  for (const [parameterId, value] of Object.entries(module.parameters ?? {})) {
    const parameter = knownParameters.get(parameterId);
    if (!parameter) throw new Error(`Unknown parameter ${parameterId} on module ${module.id}`);
    if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`Parameter ${module.id}.${parameterId} must be a finite number`);
    if (value < parameter.min || value > parameter.max) throw new Error(`Parameter ${module.id}.${parameterId} is outside its allowed range`);
  }
  assertFiniteTree(module.state ?? {}, `module ${module.id} state`);
  return { unknown: false };
}

function documentToPatch(document) {
  if (!Array.isArray(document.modules)) throw new Error('Patch modules must be an array');
  if (!Array.isArray(document.connections)) throw new Error('Patch connections must be an array');
  if (document.modules.length > 1000) throw new Error('Patch exceeds module safety limit');
  if (document.connections.length > 5000) throw new Error('Patch exceeds connection safety limit');

  const modules = {};
  for (const raw of document.modules) {
    const validation = validateModule(raw);
    if (modules[raw.id]) throw new Error(`Duplicate module id: ${raw.id}`);
    if (validation?.unknown) {
      assertFiniteTree(raw, `unknown module ${raw.id}`);
      modules[raw.id] = {
        id: raw.id,
        type: 'system.unknown-placeholder',
        moduleVersion: 1,
        scope: 'global',
        position: { x: Number.isFinite(raw.ui?.x) ? raw.ui.x : 0, y: Number.isFinite(raw.ui?.y) ? raw.ui.y : 0 },
        parameters: {},
        enabled: false,
        name: raw.name ?? raw.id,
        state: { originalType: raw.type, originalModule: structuredClone(raw) }
      };
      continue;
    }
    modules[raw.id] = {
      id: raw.id,
      type: raw.type,
      moduleVersion: raw.moduleVersion ?? 1,
      scope: raw.scope,
      position: {
        x: Number.isFinite(raw.ui?.x) ? raw.ui.x : 0,
        y: Number.isFinite(raw.ui?.y) ? raw.ui.y : 0
      },
      parameters: structuredClone(raw.parameters ?? {}),
      ...(raw.name && raw.name !== raw.id ? { name: raw.name } : {}),
      ...(raw.state && Object.keys(raw.state).length ? { state: structuredClone(raw.state) } : {}),
      ...(raw.enabled === false ? { enabled: false } : {}),
      ...(raw.bypass ? { bypass: true } : {}),
      ...(raw.muted ? { muted: true } : {})
    };
  }

  const connections = document.connections.map(raw => {
    if (!raw || typeof raw !== 'object' || !raw.id) throw new Error('Patch connection requires an id');
    const from = structuredClone(raw.source);
    const to = structuredClone(raw.destination);
    if (!from?.moduleId || !to?.moduleId) throw new Error(`Connection ${raw.id} requires source and destination endpoints`);
    if (!modules[from.moduleId] || !modules[to.moduleId]) throw new Error(`Connection ${raw.id} references a missing module endpoint`);
    const quarantined = modules[from.moduleId]?.type === 'system.unknown-placeholder' || modules[to.moduleId]?.type === 'system.unknown-placeholder';
    return {
      id: raw.id,
      from,
      to,
      ...(raw.signal ? { signal: raw.signal } : {}),
      ...((raw.enabled === false || quarantined) ? { enabled: false } : {}),
      ...(raw.ui ? { ui: structuredClone(raw.ui) } : {})
    };
  });

  const settings = structuredClone(document.settings ?? {});
  if (document.description && !settings.description) settings.description = document.description;
  const patch = createPatchState({
    name: document.name ?? 'Untitled Patch',
    modules,
    connections,
    settings,
    ...(document.transport && Object.keys(document.transport).length ? { transport: structuredClone(document.transport) } : {}),
    ...(Array.isArray(document.modulations) && document.modulations.length ? { modulations: structuredClone(document.modulations) } : {}),
    ...(Array.isArray(document.automation) && document.automation.length ? { automation: structuredClone(document.automation) } : {}),
    ...(Array.isArray(document.probes) && document.probes.length ? { probes: structuredClone(document.probes) } : {}),
    ...(Array.isArray(document.midiMappings) && document.midiMappings.length ? { midiMappings: structuredClone(document.midiMappings) } : {}),
    ...(document.performanceView && Object.keys(document.performanceView).length ? { performanceView: structuredClone(document.performanceView) } : {}),
    ...(document.ui && Object.keys(document.ui).length ? { ui: structuredClone(document.ui) } : {}),
    ...(document.extensions && Object.keys(document.extensions).length ? { extensions: structuredClone(document.extensions) } : {})
  });

  assertFiniteTree(patch, 'patch');
  const validation = validatePatchGraph(patch);
  if (!validation.valid) throw new Error(`Patch graph is invalid: ${validation.errors.join('; ')}`);
  return patch;
}

export function serializePatch(patch) {
  const document = toDocument(patch);
  assertFiniteTree(document, 'patch document');
  return JSON.stringify(document, null, 2);
}

export function parsePatch(json) {
  if (typeof json !== 'string') throw new Error('Patch input must be JSON text');
  if (new TextEncoder().encode(json).length > MAX_PATCH_BYTES) throw new Error('Patch exceeds 10 MB import limit');
  let parsed;
  try {
    parsed = JSON.parse(json);
  } catch (error) {
    throw new Error(`Invalid patch JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  return documentToPatch(migratePatch(parsed));
}
