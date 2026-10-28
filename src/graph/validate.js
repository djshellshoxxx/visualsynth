import { getModuleType } from './registry.js';

function getPort(definition, portId, direction) {
  return definition.ports.find((port) => port.id === portId && port.direction === direction);
}

function detectCycle(moduleIds, connections) {
  const adjacency = new Map(moduleIds.map((id) => [id, []]));
  for (const edge of connections) {
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
  if (!patch || typeof patch !== 'object' || Array.isArray(patch)) return { valid: false, errors: ['Patch must be an object'] };
  const modules = patch.modules ?? {};
  const connections = patch.connections ?? [];
  if (!modules || typeof modules !== 'object' || Array.isArray(modules) || !Array.isArray(connections)) return { valid: false, errors: ['Invalid modules or connections collection'] };
  if (Object.keys(modules).length > 1000 || connections.length > 5000) return { valid: false, errors: ['Patch exceeds graph safety limits'] };
  const inputUse = new Map();
  const connectionIds = new Set();

  for (const [id, module] of Object.entries(modules)) {
    if (!module || typeof module !== 'object' || module.id !== id) { errors.push(`Invalid module identity: ${id}`); continue; }
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
    if (!edge || typeof edge.id !== 'string' || !edge.id || !edge.from || !edge.to) { errors.push('Invalid connection endpoints or id'); continue; }
    if (connectionIds.has(edge.id)) errors.push(`Duplicate connection id: ${edge.id}`);
    connectionIds.add(edge.id);
    const source = modules[edge.from.moduleId];
    const target = modules[edge.to.moduleId];
    if (!Object.hasOwn(modules, edge.from.moduleId) || !source) {
      errors.push(`Connection ${edge.id} references missing source module ${edge.from.moduleId}`);
      continue;
    }
    if (!Object.hasOwn(modules, edge.to.moduleId) || !target) {
      errors.push(`Connection ${edge.id} references missing target module ${edge.to.moduleId}`);
      continue;
    }

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

    if (edge.enabled === false) continue;
    const inputKey = `${target.id}:${targetPort.id}`;
    const count = (inputUse.get(inputKey) ?? 0) + 1;
    inputUse.set(inputKey, count);
    if (!targetPort.multiple && count > 1) {
      errors.push(`Input ${inputKey} does not allow multiple sources`);
    }
  }

  if (errors.length === 0 && detectCycle(Object.keys(modules), connections.filter(edge => edge.enabled !== false))) {
    errors.push('Graph contains a zero-delay cycle');
  }

  return { valid: errors.length === 0, errors };
}
