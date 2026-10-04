import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { validatePatchGraph } from '../../src/graph/validate.js';
import { createPatchState } from '../../src/state/patch-state.js';

function patch(modules, connections) {
  return { ...createPatchState(), modules: Object.fromEntries(modules.map((module) => [module.id, module])), connections };
}

const moduleOf = (id, type, scope = 'global') => ({ id, type, scope, moduleVersion: 1, position: { x: 0, y: 0 }, parameters: {} });
const connection = (id, fromModule, fromPort, toModule, toPort) => ({
  id,
  from: { moduleId: fromModule, portId: fromPort },
  to: { moduleId: toModule, portId: toPort }
});

describe('validatePatchGraph', () => {
  beforeEach(() => {
    clearModuleRegistry();
    registerCoreModuleTypes();
  });

  test('accepts compatible audio connections', () => {
    const state = patch(
      [moduleOf('osc', 'core.oscillator'), moduleOf('mix', 'core.mixer')],
      [connection('c1', 'osc', 'audioOut', 'mix', 'audioInA')]
    );
    expect(validatePatchGraph(state).valid).toBe(true);
  });

  test('rejects incompatible signal classes', () => {
    const state = patch(
      [moduleOf('osc', 'core.oscillator'), moduleOf('filter', 'core.filter')],
      [connection('c1', 'osc', 'audioOut', 'filter', 'cutoffMod')]
    );
    const result = validatePatchGraph(state);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/signal type/i);
  });

  test('rejects missing modules and ports', () => {
    const state = patch([moduleOf('osc', 'core.oscillator')], [connection('c1', 'osc', 'missing', 'gone', 'audioIn')]);
    const result = validatePatchGraph(state);
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
  });

  test('rejects multiple sources into a single non-multiple input', () => {
    const state = patch(
      [moduleOf('a', 'core.oscillator'), moduleOf('b', 'core.oscillator'), moduleOf('filter', 'core.filter')],
      [
        connection('c1', 'a', 'audioOut', 'filter', 'audioIn'),
        connection('c2', 'b', 'audioOut', 'filter', 'audioIn')
      ]
    );
    expect(validatePatchGraph(state).valid).toBe(false);
  });

  test('rejects zero-delay cycles', () => {
    const state = patch(
      [moduleOf('a', 'core.mixer'), moduleOf('b', 'core.mixer')],
      [
        connection('c1', 'a', 'audioOut', 'b', 'audioInA'),
        connection('c2', 'b', 'audioOut', 'a', 'audioInA')
      ]
    );
    const result = validatePatchGraph(state);
    expect(result.valid).toBe(false);
    expect(result.errors.join(' ')).toMatch(/cycle/i);
  });

  test('rejects direct voice-to-global crossings without an explicit boundary', () => {
    const state = patch(
      [moduleOf('osc', 'core.oscillator', 'voice'), moduleOf('mix', 'core.mixer', 'global')],
      [connection('c1', 'osc', 'audioOut', 'mix', 'audioInA')]
    );
    expect(validatePatchGraph(state).valid).toBe(false);
  });
});
