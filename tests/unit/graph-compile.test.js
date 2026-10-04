import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { createPatchState } from '../../src/state/patch-state.js';

const moduleOf = (id, type, scope = 'global') => ({ id, type, scope, moduleVersion: 1, position: { x: 0, y: 0 }, parameters: {} });
const connection = (id, fromModule, fromPort, toModule, toPort) => ({ id, from: { moduleId: fromModule, portId: fromPort }, to: { moduleId: toModule, portId: toPort } });

function buildPatch(modules, connections) {
  return { ...createPatchState(), modules: Object.fromEntries(modules.map((module) => [module.id, module])), connections };
}

describe('compilePatchGraph', () => {
  beforeEach(() => {
    clearModuleRegistry();
    registerCoreModuleTypes();
  });

  test('produces deterministic topological node order', () => {
    const state = buildPatch(
      [moduleOf('master', 'core.master-output'), moduleOf('mix', 'core.mixer'), moduleOf('osc', 'core.oscillator')],
      [
        connection('c2', 'mix', 'audioOut', 'master', 'audioIn'),
        connection('c1', 'osc', 'audioOut', 'mix', 'audioInA')
      ]
    );

    const compiled = compilePatchGraph(state);
    expect(compiled.nodes.map((node) => node.id)).toEqual(['osc', 'mix', 'master']);
    expect(compiled.connections.map((edge) => edge.id)).toEqual(['c1', 'c2']);
  });

  test('includes disconnected modules deterministically after dependencies are satisfied', () => {
    const state = buildPatch(
      [moduleOf('z-lfo', 'core.lfo'), moduleOf('a-osc', 'core.oscillator')],
      []
    );
    expect(compilePatchGraph(state).nodes.map((node) => node.id)).toEqual(['a-osc', 'z-lfo']);
  });

  test('throws on invalid graphs and returns no partial compiled graph', () => {
    const state = buildPatch(
      [moduleOf('a', 'core.mixer'), moduleOf('b', 'core.mixer')],
      [
        connection('c1', 'a', 'audioOut', 'b', 'audioInA'),
        connection('c2', 'b', 'audioOut', 'a', 'audioInA')
      ]
    );
    expect(() => compilePatchGraph(state)).toThrow(/invalid patch graph/i);
  });
});
