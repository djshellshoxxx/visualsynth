import { getModuleType } from './registry.js';
import { validatePatchGraph } from './validate.js';

const MODULATION_DESTINATIONS = Object.freeze({
  'core.oscillator:fmIn': Object.freeze({ parameterId: 'pitch', scaling: 'semitones' }),
  'core.oscillator:pmIn': Object.freeze({ parameterId: 'phase', scaling: 'cycles' }),
  'core.filter:cutoffMod': Object.freeze({ parameterId: 'cutoff', scaling: 'octaves' }),
  'core.vca:gainIn': Object.freeze({ parameterId: 'gain', scaling: 'linear' })
});

function topologicalOrder(patch) {
  const moduleIds = Object.keys(patch.modules ?? {}).sort();
  const indegree = new Map(moduleIds.map((id) => [id, 0]));
  const adjacency = new Map(moduleIds.map((id) => [id, []]));

  for (const edge of patch.connections ?? []) {
    adjacency.get(edge.from.moduleId)?.push(edge.to.moduleId);
    indegree.set(edge.to.moduleId, (indegree.get(edge.to.moduleId) ?? 0) + 1);
  }

  for (const values of adjacency.values()) values.sort();

  const ready = moduleIds.filter((id) => indegree.get(id) === 0).sort();
  const order = [];

  while (ready.length > 0) {
    const id = ready.shift();
    order.push(id);
    for (const next of adjacency.get(id) ?? []) {
      indegree.set(next, indegree.get(next) - 1);
      if (indegree.get(next) === 0) {
        ready.push(next);
        ready.sort();
      }
    }
  }

  if (order.length !== moduleIds.length) throw new Error('Invalid patch graph: cycle detected during compilation');
  return order;
}

function modulationDescriptor(patch, edge) {
  const target = patch.modules?.[edge.to.moduleId];
  if (!target) return null;
  const mapping = MODULATION_DESTINATIONS[`${target.type}:${edge.to.portId}`];
  if (!mapping) return null;
  const targetDefinition = getModuleType(target.type);
  const targetPort = targetDefinition.ports.find(port => port.id === edge.to.portId && port.direction === 'input');
  if (targetPort?.signalType !== 'control') return null;

  const settings = edge.modulation ?? {};
  return {
    id: edge.id,
    source: { ...edge.from },
    destination: { ...edge.to, parameterId: mapping.parameterId },
    amount: Number.isFinite(settings.amount) ? settings.amount : 1,
    polarity: settings.polarity === 'unipolar' ? 'unipolar' : 'bipolar',
    scaling: settings.scaling ?? mapping.scaling,
    curve: settings.curve ?? 'linear',
    inputRange: Array.isArray(settings.inputRange) && settings.inputRange.length === 2
      ? [settings.inputRange[0], settings.inputRange[1]]
      : (settings.polarity === 'unipolar' ? [0, 1] : [-1, 1])
  };
}

export function compilePatchGraph(patch) {
  const validation = validatePatchGraph(patch);
  if (!validation.valid) {
    throw new Error(`Invalid patch graph: ${validation.errors.join('; ')}`);
  }

  const order = topologicalOrder(patch);
  const nodes = order.map((id, index) => {
    const instance = patch.modules[id];
    const definition = getModuleType(instance.type);
    return {
      index,
      id,
      type: instance.type,
      scope: instance.scope,
      parameters: { ...(instance.parameters ?? {}) },
      ports: definition.ports.map((port) => ({ ...port }))
    };
  });

  const sortedEdges = [...(patch.connections ?? [])].sort((a, b) => a.id.localeCompare(b.id));
  const modulations = [];
  const connections = [];
  for (const edge of sortedEdges) {
    const modulation = modulationDescriptor(patch, edge);
    if (modulation) {
      modulations.push(modulation);
      continue;
    }
    connections.push({
      id: edge.id,
      from: { ...edge.from },
      to: { ...edge.to }
    });
  }

  return {
    formatVersion: 1,
    nodes,
    connections,
    modulations
  };
}
