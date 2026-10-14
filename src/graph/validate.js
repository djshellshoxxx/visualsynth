import { getModuleType } from './registry.js';

function getPort(definition, portId, direction) {
  return definition.ports.find((port) => port.id === portId && port.direction === direction);
}

function detectCycle(moduleIds, connections, modules = {}) {
  const adjacency = new Map(moduleIds.map((id) => [id, []]));
  for (const edge of connections) {
    if (edge.enabled === false) continue;
    if (modules[edge.from.moduleId]?.type === 'core.feedback-delay') continue;
    if (modules[edge.from.moduleId]?.enabled === false || modules[edge.to.moduleId]?.enabled === false) continue;
    if (adjacency.has(edge.from.moduleId)) adjacency.get(edge.from.moduleId).push(edge.to.moduleId);
  }

  const visiting = new Set();
  const visited = new Set();

  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    for (const next of adjacency.get(id) ?? []) {
      if (visit(next)) return true;
    }
    visiting.delete(id);
    visited.add(id);
    return false;
  }

  return moduleIds.some((id) => visit(id));
}

export function validatePatchGraph(patch) {
  const errors = [];
  const modules = patch.modules ?? {};
  const connections = patch.connections ?? [];
  const inputUse = new Map();

  for (const module of Object.values(modules)) {
    let definition;
    try {
      definition = getModuleType(module.type);
    } catch (error) {
      errors.push(error.message);
      continue;
    }
    if (!definition.allowedScopes.includes(module.scope)) {
      errors.push(`Scope ${module.scope} is not allowed for ${module.id}`);
    }
  }

  for (const edge of connections) {
    if (edge.enabled === false) continue;
    const source = modules[edge.from.moduleId];
    const target = modules[edge.to.moduleId];
    if (!source) {
      errors.push(`Connection ${edge.id} references missing source module ${edge.from.moduleId}`);
      continue;
    }
    if (!target) {
      errors.push(`Connection ${edge.id} references missing target module ${edge.to.moduleId}`);
      continue;
    }
    if (source.enabled === false || target.enabled === false) continue;

    let sourceDefinition;
    let targetDefinition;
    try {
      sourceDefinition = getModuleType(source.type);
      targetDefinition = getModuleType(target.type);
    } catch (error) {
      errors.push(error.message);
      continue;
    }

    const sourcePort = getPort(sourceDefinition, edge.from.portId, 'output');
    const targetPort = getPort(targetDefinition, edge.to.portId, 'input');
    if (!sourcePort) {
      errors.push(`Connection ${edge.id} references missing output port ${edge.from.portId}`);
      continue;
    }
    if (!targetPort) {
      errors.push(`Connection ${edge.id} references missing input port ${edge.to.portId}`);
      continue;
    }

    if (sourcePort.signalType !== targetPort.signalType) {
      errors.push(`Connection ${edge.id} signal type mismatch: ${sourcePort.signalType} -> ${targetPort.signalType}`);
    }

    if (source.scope === 'voice' && target.scope === 'global' && !targetPort.voiceBoundary) {
      errors.push(`Connection ${edge.id} crosses voice to global scope without an explicit voice boundary`);
    }

    const inputKey = `${target.id}:${targetPort.id}`;
    const count = (inputUse.get(inputKey) ?? 0) + 1;
    inputUse.set(inputKey, count);
    if (!targetPort.multiple && count > 1) {
      errors.push(`Input ${inputKey} does not allow multiple sources`);
    }
  }

  if (detectCycle(Object.keys(modules), connections, modules)) {
    errors.push('Graph contains a zero-delay cycle');
  }

  return { valid: errors.length === 0, errors };
}
