import { beforeEach, describe, expect, test } from 'vitest';
import {
  AudioToControl, ControlToAudio, FunctionGenerator, GenerativeRouter, HarmonicExciter, ProbabilityRouter, SampleDelay,
  compileExpression, fmExcursionToRatio, fmOperator, parseExpression, validateExpressionAst, waveshape
} from '../../src/dsp/utility-modules.js';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

const sine = (hz, i, sr = 48000) => Math.sin(2 * Math.PI * hz * i / sr);

describe('fm/pm operator', () => {
  test('scaling, polarity, bias and clamping', () => {
    expect(fmOperator(0.5, 1, 100, 10, 1)).toBe(60);
    expect(fmOperator(0.5, 1, 100, 10, -1)).toBe(-40);
    expect(fmOperator(1, 3, 1000)).toBe(10);
    expect(fmOperator(NaN, 0, 1)).toBe(0);
    expect(fmExcursionToRatio(12, 2)).toBeCloseTo(2);
    expect(fmExcursionToRatio(1, 3)).toBeCloseTo(2);
    expect(Number.isFinite(fmExcursionToRatio(1e9, 3))).toBe(true);
  });
});

describe('waveshaper', () => {
  test('transfer endpoints and finiteness for every mode', () => {
    expect(waveshape(0, 0, 4)).toBe(0);
    expect(waveshape(10, 1, 1)).toBe(1);
    expect(waveshape(-10, 1, 1)).toBe(-1);
    expect(waveshape(-0.5, 3, 1)).toBeCloseTo(0.5);
    expect(waveshape(1, 2, 1)).toBeCloseTo(0.5);
    for (let m = 0; m < 5; m++) expect(Number.isFinite(waveshape(Infinity, m, 1e9, NaN))).toBe(true);
  });
  test('custom curve interpolates linearly', () => {
    const curve = [-1, 0, 1, 1];
    expect(waveshape(-1, 4, 1, 0, curve)).toBe(-1);
    expect(waveshape(1, 4, 1, 0, curve)).toBe(1);
    expect(waveshape(-1 / 3, 4, 1, 0, curve)).toBeCloseTo(0);
    expect(waveshape(-2 / 3, 4, 1, 0, curve)).toBeCloseTo(-0.5);
  });
});

describe('probability router', () => {
  const run = (seed, weights, exclusive, n = 4000) => {
    const r = new ProbabilityRouter({ seed });
    const counts = [0, 0, 0, 0];
    for (let i = 0; i < n; i++) { r.processSample(0, weights, exclusive); r.processSample(1, weights, exclusive).forEach((v, k) => { counts[k] += v; }); }
    return counts;
  };
  test('exclusive distribution matches weights and is deterministic', () => {
    const c = run(7, [3, 1, 0, 0], true);
    expect(c[2] + c[3]).toBe(0);
    expect(c[0] / (c[0] + c[1])).toBeGreaterThan(0.72);
    expect(c[0] / (c[0] + c[1])).toBeLessThan(0.78);
    expect(run(7, [3, 1, 0, 0], true)).toEqual(c);
  });
  test('independent mode and zero total weight', () => {
    const c = run(2, [1, 0.5, 0, 0], false);
    expect(c[0]).toBe(4000);
    expect(c[1] / 4000).toBeGreaterThan(0.45);
    expect(run(2, [0, 0, 0, 0], true)).toEqual([0, 0, 0, 0]);
  });
  test('only fires on rising edges', () => {
    const r = new ProbabilityRouter({ seed: 1 });
    expect(r.processSample(1, [1], true)[0]).toBe(1);
    expect(r.processSample(1, [1], true)[0]).toBe(0);
  });
});

describe('function generator', () => {
  test('parser builds whitelisted AST and evaluates', () => {
    const f = compileExpression(parseExpression('2*sin(pi*phase)+abs(-0.5)^0'.replace('^0', '')));
    expect(f({ phase: 0.5, t: 0, in: 0 })).toBeCloseTo(2.5);
    expect(compileExpression(parseExpression('pow(2, 3)'))({ phase: 0, t: 0, in: 0 })).toBe(8);
  });
  test('rejects unsafe or invalid input', () => {
    for (const src of ['alert(1)', 'phase.constructor', 'sin(', 'sin(1,2)', '1 +', 'x', '__proto__', 'a'.repeat(300)]) expect(parseExpression(src)).toBeNull();
    expect(compileExpression({ type: 'call', name: 'constructor', args: [] })).toBeNull();
    expect(validateExpressionAst(null)).toBe(false);
    expect(parseExpression('(' .repeat(40) + '1' + ')'.repeat(40))).toBeNull();
    expect(parseExpression(Array(60).fill('phase').join('+'))).toBeNull();
  });
  test('division by zero and huge exponents stay finite; generator is bounded', () => {
    const vars = { phase: 0, t: 0, in: 0 };
    expect(compileExpression(parseExpression('1/phase'))(vars)).toBe(0);
    expect(Number.isFinite(compileExpression(parseExpression('pow(1000000, 16)'))(vars))).toBe(true);
    const g = new FunctionGenerator({ sampleRate: 1000, frequency: 10, ast: parseExpression('phase*100') });
    for (let i = 0; i < 500; i++) expect(Math.abs(g.processSample(0, 1))).toBeLessThanOrEqual(1);
    const d = new FunctionGenerator({ sampleRate: 1000, frequency: 1, ast: { bad: true } });
    expect(Number.isFinite(d.processSample())).toBe(true);
  });
  test('default sine reaches peak at quarter period', () => {
    const g = new FunctionGenerator({ sampleRate: 1000, frequency: 1 });
    let y = 0; for (let i = 0; i <= 250; i++) y = g.processSample();
    expect(y).toBeCloseTo(1, 2);
  });
});

describe('audio/control conversion', () => {
  test('modes produce expected values for constant and sine input', () => {
    const mk = mode => new AudioToControl({ sampleRate: 1000, mode, rate: 100 });
    let a = mk(0), v = 0; for (let i = 0; i < 100; i++) v = a.processSample(0.5); expect(v).toBe(0.5);
    a = mk(1); for (let i = 0; i < 100; i++) v = a.processSample(sine(100, i, 1000)); expect(Math.abs(v)).toBeLessThan(0.1);
    a = mk(2); for (let i = 0; i < 200; i++) v = a.processSample(sine(50, i, 1000)); expect(v).toBeCloseTo(Math.SQRT1_2, 1);
    a = mk(3); for (let i = 0; i < 200; i++) v = a.processSample(sine(50, i, 1000)); expect(v).toBeGreaterThan(0.8);
  });
  test('control to audio smooths steps and passes through at zero smoothing', () => {
    const c = new ControlToAudio({ sampleRate: 1000, smoothing: 0.01 });
    const y = c.processSample(1);
    expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(0.5);
    let v = 0; for (let i = 0; i < 200; i++) v = c.processSample(1); expect(v).toBeCloseTo(1, 3);
    expect(new ControlToAudio({ smoothing: 0 }).processSample(0.7)).toBe(0.7);
  });
});

describe('sample delay', () => {
  test('delays by exactly N samples', () => {
    for (const n of [0, 1, 7, 4096]) {
      const d = new SampleDelay({ delay: n });
      const out = []; for (let i = 0; i < n + 5; i++) out.push(d.processSample(i === 0 ? 1 : 0));
      expect(out.indexOf(1)).toBe(n);
    }
    expect(new SampleDelay({ delay: 1e9 }).delay).toBe(4096);
  });
});

describe('harmonic exciter', () => {
  const energy = (ex, hz) => { let e = 0; for (let i = 0; i < 4800; i++) { const y = ex.processSample(sine(hz, i)); expect(Number.isFinite(y)).toBe(true); if (i > 2400) e += y * y; } return e; };
  test('amount 0 is transparent and amount adds energy', () => {
    const dry = new HarmonicExciter({ amount: 0 });
    for (let i = 0; i < 100; i++) expect(dry.processSample(sine(440, i))).toBeCloseTo(sine(440, i), 6);
    expect(energy(new HarmonicExciter({ amount: 0.8, frequency: 200, drive: 8 }), 1000)).toBeGreaterThan(energy(new HarmonicExciter({ amount: 0 }), 1000));
  });
  test('pitch tracking moves the cutoff and missing pitch falls back safely', () => {
    const ex = new HarmonicExciter({ harmonic: 2 });
    ex.set({ harmonic: 2, pitch: 69 }); const a = ex.cutoff;
    ex.set({ harmonic: 2, pitch: 81 }); expect(ex.cutoff).toBeCloseTo(a * 2, 3);
    ex.set({ harmonic: 2, frequency: 1000, pitch: null }); expect(ex.cutoff).toBe(2000);
    ex.set({ harmonic: 2, pitch: NaN, frequency: 1000 }); expect(Number.isFinite(ex.cutoff)).toBe(true);
  });
});

describe('generative event router', () => {
  const run = (seed, opts, n = 1000) => {
    const r = new GenerativeRouter({ seed });
    const hits = []; const out = [];
    for (let i = 0; i < n; i++) { r.processSample(0, opts); const o = r.processSample(1, opts); out.push(o); hits.push(o.indexOf(1)); }
    return { hits, out };
  };
  test('deterministic, one-hot pulses, density respected', () => {
    const a = run(3, { density: 0.5, memory: 0.3 }), b = run(3, { density: 0.5, memory: 0.3 });
    expect(a.hits).toEqual(b.hits);
    expect(a.out.every(o => o.reduce((x, y) => x + y, 0) <= 1)).toBe(true);
    const fired = a.hits.filter(h => h >= 0).length;
    expect(fired).toBeGreaterThan(400); expect(fired).toBeLessThan(600);
    expect(run(3, { density: 0 }).hits.every(h => h < 0)).toBe(true);
  });
  test('max repeat constraint holds even with full memory', () => {
    const { hits } = run(5, { density: 1, memory: 1, maxRepeats: 2 });
    let streak = 1, longest = 1;
    for (let i = 1; i < hits.length; i++) { streak = hits[i] === hits[i - 1] ? streak + 1 : 1; longest = Math.max(longest, streak); }
    expect(longest).toBeLessThanOrEqual(2);
  });
});

describe('new modules run through the graph', () => {
  beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); registerBetaModuleTypes(); });
  test.each(['beta.waveshaper', 'beta.sample-delay', 'beta.harmonic-exciter'])('%s processes audio', type => {
    const mod = (id, t, parameters = {}) => ({ id, type: t, scope: 'global', moduleVersion: 1, position: { x: 0, y: 0 }, parameters });
    const inPort = 'audioIn';
    const modules = [mod('osc', 'core.oscillator', { waveform: 0, amplitude: 0.8 }), mod('fx', type, { delay: 3, drive: 4 }), mod('master', 'core.master-output')];
    const patch = { formatVersion: 1, name: 't', modules: Object.fromEntries(modules.map(m => [m.id, m])), connections: [{ id: 'a', from: { moduleId: 'osc', portId: 'audioOut' }, to: { moduleId: 'fx', portId: inPort } }, { id: 'b', from: { moduleId: 'fx', portId: 'audioOut' }, to: { moduleId: 'master', portId: 'audioIn' } }], settings: {} };
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph({ ...compilePatchGraph(patch), revision: 1 }, 1);
    const block = runtime.processBlock(512);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
    expect(Math.max(...block.left.map(Math.abs))).toBeGreaterThan(0);
  });
  test('audio-to-control -> control-to-audio chain yields a finite envelope', () => {
    const mod = (id, t, parameters = {}) => ({ id, type: t, scope: 'global', moduleVersion: 1, position: { x: 0, y: 0 }, parameters });
    const modules = [mod('osc', 'core.oscillator', { waveform: 0, amplitude: 0.8 }), mod('a2c', 'beta.audio-to-control', { mode: 3 }), mod('c2a', 'beta.control-to-audio', { smoothing: 0.002 }), mod('master', 'core.master-output')];
    const link = (id, a, ap, b, bp) => ({ id, from: { moduleId: a, portId: ap }, to: { moduleId: b, portId: bp } });
    const patch = { formatVersion: 1, name: 't', modules: Object.fromEntries(modules.map(m => [m.id, m])), connections: [link('a', 'osc', 'audioOut', 'a2c', 'audioIn'), link('b', 'a2c', 'controlOut', 'c2a', 'controlIn'), link('c', 'c2a', 'audioOut', 'master', 'audioIn')], settings: {} };
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph({ ...compilePatchGraph(patch), revision: 1 }, 1);
    const block = runtime.processBlock(2048);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
    expect(Math.max(...block.left.map(Math.abs))).toBeGreaterThan(0);
  });
});
