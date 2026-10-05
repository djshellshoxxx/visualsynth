import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry, getModuleType, listModuleTypes } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerStandardModuleTypes, STANDARD_MODULE_DEFINITIONS } from '../../src/modules/standard-definitions.js';

describe('standard module definitions', () => {
  beforeEach(() => clearModuleRegistry());

  test('registers Noise Generator without changing the core module set', () => {
    registerCoreModuleTypes();
    registerStandardModuleTypes();
    const noise = getModuleType('standard.noise');

    expect(noise.classification).toBe('STANDARD');
    expect(noise.allowedScopes).toEqual(expect.arrayContaining(['voice', 'global']));
    expect(noise.ports).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'gateIn', direction: 'input', signalType: 'gate' }),
      expect.objectContaining({ id: 'audioOut', direction: 'output', signalType: 'audio' })
    ]));
    expect(noise.parameters).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'type', choices: ['white', 'pink', 'brown'] }),
      expect.objectContaining({ id: 'level', min: 0, max: 1 }),
      expect.objectContaining({ id: 'seed' })
    ]));
    expect(STANDARD_MODULE_DEFINITIONS.map(definition => definition.typeId)).toContain('standard.noise');
    expect(listModuleTypes().map(definition => definition.typeId).at(-1)).toBe('standard.noise');
  });
});
