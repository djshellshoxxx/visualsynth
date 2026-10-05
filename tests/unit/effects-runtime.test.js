import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

const mod = (id, type, scope, parameters = {}) => ({ id, type, scope, moduleVersion: 1, position: { x: 0, y: 0 }, parameters });
const cable = (id, fromModule, fromPort, toModule, toPort) => ({ id, from: { moduleId: fromModule, portId: fromPort }, to: { moduleId: toModule, portId: toPort } });

function effectPatch(effectType, effectParameters = {}) {
  const modules = [
    mod('osc', 'core.oscillator', 'global', { waveform: 0, amplitude: 0.5, frequency: 220, pulseWidth: 0.5 }),
    mod('fx', effectType, 'global', effectParameters),
    mod('master', 'core.master-output', 'global', { gain: 0.8 })
  ];
  return {
    formatVersion: 1,
    name: `Test ${effectType}`,
    modules: Object.fromEntries(modules.map(module => [module.id, module])),
    connections: [
      cable('c1', 'osc', 'audioOut', 'fx', 'audioIn'),
      cable('c2', 'fx', 'audioOut', 'master', 'audioIn')
    ],
    settings: {}
  };
}

describe('patchable effects', () => {
  beforeEach(() => {
    clearModuleRegistry();
    registerCoreModuleTypes();
  });

  test.each([
    ['core.distortion', { drive: 3, tone: 0.6, mix: 1 }],
    ['core.delay', { time: 0.02, feedback: 0.25, damping: 0.25, mix: 0.5 }],
    ['core.echo', { time: 0.04, feedback: 0.55, damping: 0.4, mix: 0.45 }]
  ])('%s compiles and produces finite audio', (effectType, parameters) => {
    const graph = compilePatchGraph(effectPatch(effectType, parameters));
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    expect(runtime.applyGraph({ ...graph, revision: 1 }, 1)).toBe(true);
    const block = runtime.processBlock(256);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
    expect(block.left.some(sample => Math.abs(sample) > 0)).toBe(true);
  });

  test('filter exposes switchable modes and accepts mode parameter updates', () => {
    const graph = compilePatchGraph(effectPatch('core.filter', { cutoff: 1500, resonance: 0.2, drive: 0, mode: 0 }));
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph({ ...graph, revision: 1 }, 1);
    expect(runtime.setParameter('fx', 'mode', 2)).toBe(true);
    const block = runtime.processBlock(64);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
  });
});
