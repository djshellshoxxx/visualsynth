import { beforeEach, describe, expect, test } from 'vitest';
import { PhaseInterference, SpectralAnalyzer, fftMagnitudes } from '../../src/dsp/utility-modules.js';
import { planMutation } from '../../src/random/mutation-controller.js';
import { clearModuleRegistry, getModuleType } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';

const sr = 48000;
describe('SpectralAnalyzer', () => {
  test('FFT finds a known tone bin', () => {
    const n = 512, f = 40 * sr / n;
    const mags = fftMagnitudes(Float64Array.from({ length: n }, (_, i) => Math.sin(2 * Math.PI * f * i / sr)));
    expect(mags.indexOf(Math.max(...mags))).toBe(40);
    expect(mags[40]).toBeCloseTo(1, 3);
  });
  test('band energy and centroid follow tone frequency', () => {
    const run = hz => { const a = new SpectralAnalyzer({ sampleRate: sr, size: 1024 }); let r; for (let i = 0; i < 1024; i++) r = a.processSample(Math.sin(2 * Math.PI * hz * i / sr)); return r; };
    const lo = run(100), hi = run(8000);
    expect(lo.low).toBeGreaterThan(lo.high); expect(hi.high).toBeGreaterThan(hi.low);
    expect(hi.centroid).toBeGreaterThan(lo.centroid);
  });
  test('noise/silence stays finite', () => {
    const a = new SpectralAnalyzer({ sampleRate: sr, size: 256 }); let r;
    for (let i = 0; i < 256; i++) r = a.processSample(0);
    expect(r).toEqual({ low: 0, mid: 0, high: 0, centroid: 0 });
    for (let i = 0; i < 256; i++) r = a.processSample(Math.random() * 2 - 1);
    expect(Object.values(r).every(Number.isFinite)).toBe(true);
  });
});

describe('PhaseInterference', () => {
  const render = opts => { const lab = new PhaseInterference({ sampleRate: sr }); return Array.from({ length: 480 }, () => lab.processSample(opts)); };
  test('opposite phases cancel', () => {
    const out = render({ frequency: 220, ratios: [1, 1, 1], phases: [0, .5, 0], gains: [1, 1, 0] });
    expect(Math.max(...out.map(Math.abs))).toBeLessThan(1e-9);
  });
  test('equal phases add', () => {
    const out = render({ frequency: 220, ratios: [1, 1, 1], phases: [0, 0, 0], gains: [1, 1, 0] });
    expect(Math.max(...out)).toBeGreaterThan(0.6);
  });
});

describe('planMutation', () => {
  beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); registerBetaModuleTypes(); });
  const patch = { modules: { f: { id: 'f', type: 'core.filter', parameters: { cutoff: 1000, resonance: .3 } } } };
  const plan = opts => planMutation(patch, getModuleType, opts);
  test('is reproducible by seed', () => { expect(plan({ seed: 5 })).toEqual(plan({ seed: 5 })); });
  test('locks are respected', () => {
    const r = plan({ seed: 5, locks: ['f.cutoff'], amount: 1 });
    expect(r.changes.some(c => c.parameterId === 'cutoff')).toBe(false);
  });
  test('undo restores original values', () => {
    const r = plan({ seed: 3, amount: 1 });
    expect(r.commands.length).toBeGreaterThan(0);
    const state = { ...patch.modules.f.parameters };
    for (const c of r.commands) state[c.parameterId] = c.value;
    for (const c of r.undo) state[c.parameterId] = c.value;
    expect(state.cutoff).toBe(1000); expect(state.resonance).toBe(.3);
  });
  test('amount 0 changes nothing', () => { expect(plan({ amount: 0 }).commands).toEqual([]); });
});
