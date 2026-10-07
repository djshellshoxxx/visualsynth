import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';
import { panGains, applyWidth, stereoUtility } from '../../src/dsp/stereo.js';

const mod = (id, type, parameters = {}) => ({ id, type, scope: 'global', moduleVersion: 1, position: { x: 0, y: 0 }, parameters });
const cable = (id, a, ap, b, bp) => ({ id, from: { moduleId: a, portId: ap }, to: { moduleId: b, portId: bp } });

function runBlock(fxType, fxParams, blocks = 4) {
  const modules = [
    mod('osc', 'core.oscillator', { waveform: 0, amplitude: 0.5, frequency: 220, pulseWidth: 0.5 }),
    mod('fx', fxType, fxParams),
    mod('master', 'core.master-output', { gain: 0.8 })
  ];
  const patch = {
    formatVersion: 1, name: 'stereo', modules: Object.fromEntries(modules.map(m => [m.id, m])),
    connections: [cable('c1', 'osc', 'audioOut', 'fx', 'audioIn'), cable('c2', 'fx', 'audioOut', 'master', 'audioIn')], settings: {}
  };
  const runtime = new WorkletRuntime({ sampleRate: 48000 });
  expect(runtime.applyGraph({ ...compilePatchGraph(patch), revision: 1 }, 1)).toBe(true);
  return runtime.processBlock(128 * blocks);
}
const energy = a => a.reduce((s, x) => s + x * x, 0);

describe('stereo DSP helpers', () => {
  test('equal-power pan: centre -3.01 dB, hard pan isolates a channel', () => {
    const c = panGains(0);
    expect(20 * Math.log10(c.left)).toBeCloseTo(-3.01, 1);
    expect(panGains(-1).right).toBeCloseTo(0, 6);
    expect(panGains(1).left).toBeCloseTo(0, 6);
    expect(c.left ** 2 + c.right ** 2).toBeCloseTo(1, 9);
  });
  test('width 0 collapses to mono, width 1 is unchanged', () => {
    const m = applyWidth(1, -0.5, 0);
    expect(m.left).toBeCloseTo(m.right, 9);
    const u = applyWidth(1, -0.5, 1);
    expect(u.left).toBeCloseTo(1, 9); expect(u.right).toBeCloseTo(-0.5, 9);
  });
  test('mono switch sums to identical channels', () => {
    const o = stereoUtility(1, 0, { mono: true });
    expect(o.left).toBeCloseTo(o.right, 9);
  });
});

describe('stereo runtime path', () => {
  beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); registerBetaModuleTypes(); });

  test('mono chain still outputs identical L and R', () => {
    const out = runBlock('core.vca', { gain: 1 });
    expect(Array.from(out.left)).toEqual(Array.from(out.right));
    expect(energy(out.left)).toBeGreaterThan(0);
  });
  test('hard pan right makes L differ from R', () => {
    const out = runBlock('beta.stereo-utility', { pan: 1, width: 1, mono: 0 });
    expect(energy(out.right)).toBeGreaterThan(0);
    expect(energy(out.left)).toBeCloseTo(0, 6);
    const hardLeft = runBlock('beta.stereo-utility', { pan: -1, width: 1, mono: 0 });
    expect(energy(hardLeft.right)).toBeCloseTo(0, 6);
    expect(energy(hardLeft.left)).toBeGreaterThan(0);
  });
  test('centre pan keeps L equal to R', () => {
    const out = runBlock('beta.stereo-utility', { pan: 0, width: 0, mono: 0 });
    expect(Array.from(out.left)).toEqual(Array.from(out.right));
  });
});
