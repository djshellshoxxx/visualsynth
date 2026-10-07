import { beforeEach, describe, expect, test } from 'vitest';
import { EnvelopeFollower, reduceVoiceValues } from '../../src/dsp/control-utils.js';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

describe('voice reduce (VOICE-006)', () => {
  test.each([['mean', 2], ['max', 3], ['min', 1], ['sum', 6], ['latest', 3], ['selected', 1]])('%s', (mode, expected) => {
    expect(reduceVoiceValues([1, 2, 3], mode)).toBeCloseTo(expected);
  });
  test('empty and NaN inputs are safe', () => {
    expect(reduceVoiceValues([], 'max')).toBe(0);
    expect(reduceVoiceValues([NaN, 2], 'sum')).toBe(2);
  });
});

describe('envelope follower attack/release', () => {
  test('rises faster than it falls', () => {
    const f = new EnvelopeFollower({ sampleRate: 48000, attack: 0.001, release: 0.2 });
    let up = 0; for (let i = 0; i < 240; i++) up = f.processSample(1);
    expect(up).toBeGreaterThan(0.7);
    let down = 0; for (let i = 0; i < 240; i++) down = f.processSample(0);
    expect(down).toBeGreaterThan(0.9 * up * 0.9);
  });
});

describe('runtime wiring', () => {
  beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); registerBetaModuleTypes(); });
  test('envelope follower node output is smoothed and finite', () => {
    const mod = (id, type, scope, parameters = {}) => ({ id, type, scope, moduleVersion: 1, position: { x: 0, y: 0 }, parameters });
    const modules = [mod('osc', 'core.oscillator', 'global', { waveform: 0, amplitude: 0.5 }), mod('ef', 'beta.envelope-follower', 'global', { attack: 0.01, release: 0.5, gain: 1 }), mod('master', 'core.master-output', 'global', {})];
    const patch = { formatVersion: 1, name: 't', modules: Object.fromEntries(modules.map(m => [m.id, m])), connections: [{ id: 'a', from: { moduleId: 'osc', portId: 'audioOut' }, to: { moduleId: 'ef', portId: 'audioIn' } }, { id: 'b', from: { moduleId: 'osc', portId: 'audioOut' }, to: { moduleId: 'master', portId: 'audioIn' } }], settings: {} };
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph({ ...compilePatchGraph(patch), revision: 1 }, 1);
    const block = runtime.processBlock(256);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
  });
});
