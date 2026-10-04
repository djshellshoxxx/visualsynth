import { getModuleType } from './registry.js';
import { validatePatchGraph } from './validate.js';

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

  const connections = [...(patch.connections ?? [])]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((edge) => ({
      id: edge.id,
      from: { ...edge.from },
      to: { ...edge.to }
    }));

  return {
    formatVersion: 1,
    nodes,
    connections
  };
}
