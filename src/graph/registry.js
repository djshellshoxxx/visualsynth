import { defineModule } from './types.js';

const registry = new Map();

export function registerModuleType(definition) {
  if (!definition?.typeId) throw new Error('Module type requires a typeId');
  if (registry.has(definition.typeId)) {
    throw new Error(`Module type already registered: ${definition.typeId}`);
  }
  registry.set(definition.typeId, defineModule(definition));
}

export function getModuleType(typeId) {
  const definition = registry.get(typeId);
  if (!definition) throw new Error(`Unknown module type: ${typeId}`);
  return definition;
}

export function listModuleTypes() {
  return [...registry.values()];
}

export function clearModuleRegistry() {
  registry.clear();
}
