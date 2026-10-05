import { beforeEach, describe, expect, test } from 'vitest';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { clearModuleRegistry, registerModuleType } from '../../src/graph/registry.js';
import { CORE_MODULE_DEFINITIONS } from '../../src/modules/core-definitions.js';
import { createPatchState } from '../../src/state/patch-state.js';

const moduleOf = (id, type, scope, parameters = {}) => ({
  id, type, scope, moduleVersion: 1, position: { x: 0, y: 0 }, parameters
});
const edge = (id, fromModule, fromPort, toModule, toPort, modulation) => ({
  id,
  from: { moduleId: fromModule, portId: fromPort },
  to: { moduleId: toModule, portId: toPort },
  ...(modulation ? { modulation } : {})
});
const patch = (modules, connections) => createPatchState({
  modules: Object.fromEntries(modules.map(module => [module.id, module])),
  connections
});

describe('modulation compilation', () => {
  beforeEach(() => {
    clearModuleRegistry();
    CORE_MODULE_DEFINITIONS.forEach(registerModuleType);
  });

  test('compiles LFO to oscillator FM as a pitch modulation route', () => {
    const graph = compilePatchGraph(patch([
      moduleOf('lfo', 'core.lfo', 'voice', { rate: 5, amount: 1 }),
      moduleOf('osc', 'core.oscillator', 'voice', { waveform: 0, amplitude: 0.25 })
    ], [edge('m1', 'lfo', 'controlOut', 'osc', 'fmIn', { amount: 7, polarity: 'bipolar' })]));

    expect(graph.modulations).toEqual([
      expect.objectContaining({
        id: 'm1',
        source: { moduleId: 'lfo', portId: 'controlOut' },
        destination: { moduleId: 'osc', portId: 'fmIn', parameterId: 'pitch' },
        amount: 7,
        polarity: 'bipolar',
        scaling: 'semitones'
      })
    ]);
    expect(graph.connections).toHaveLength(0);
  });

  test('maps filter cutoff and VCA gain control inputs to parameters', () => {
    const graph = compilePatchGraph(patch([
      moduleOf('lfo', 'core.lfo', 'global'),
      moduleOf('filter', 'core.filter', 'global'),
      moduleOf('env', 'core.adsr', 'voice'),
      moduleOf('vca', 'core.vca', 'voice')
    ], [
      edge('cutoff', 'lfo', 'controlOut', 'filter', 'cutoffMod', { amount: 2, polarity: 'bipolar' }),
      edge('gain', 'env', 'controlOut', 'vca', 'gainIn', { amount: 1, polarity: 'unipolar' })
    ]));

    expect(graph.modulations).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'cutoff', destination: expect.objectContaining({ parameterId: 'cutoff' }), scaling: 'octaves' }),
      expect.objectContaining({ id: 'gain', destination: expect.objectContaining({ parameterId: 'gain' }), scaling: 'linear' })
    ]));
  });

  test('preserves multiple independent modulation sources for a multiple-capable destination', () => {
    const graph = compilePatchGraph(patch([
      moduleOf('lfo1', 'core.lfo', 'global'),
      moduleOf('lfo2', 'core.lfo', 'global'),
      moduleOf('filter', 'core.filter', 'global')
    ], [
      edge('m1', 'lfo1', 'controlOut', 'filter', 'cutoffMod', { amount: 0.5 }),
      edge('m2', 'lfo2', 'controlOut', 'filter', 'cutoffMod', { amount: 1.25 })
    ]));
    expect(graph.modulations.map(route => route.id)).toEqual(['m1', 'm2']);
  });

  test('keeps AUDIO connections as audio graph edges rather than modulation routes', () => {
    const graph = compilePatchGraph(patch([
      moduleOf('osc', 'core.oscillator', 'global'),
      moduleOf('filter', 'core.filter', 'global')
    ], [edge('a1', 'osc', 'audioOut', 'filter', 'audioIn')]));
    expect(graph.connections).toHaveLength(1);
    expect(graph.modulations).toEqual([]);
  });
});
