import { clearModuleRegistry } from '../../src/graph/registry.js';
import { beforeEach, expect, test } from 'vitest';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';
import { parsePatch, serializePatch } from '../../src/persistence/patch-schema.js';
import { VoiceEngine } from '../../src/engine/voice-engine.js';
import { AudioEngine } from '../../src/engine/audio-engine.js';
import { ComputerKeyboardInput } from '../../src/input/computer-keyboard.js';
const m = (id, type, scope = 'global', parameters = {}) => ({ id, type, scope, parameters });
const c = (id, source, sourcePort, target, targetPort) => ({ id, from: { moduleId: source, portId: sourcePort }, to: { moduleId: target, portId: targetPort } });
function patch(modules, connections) { return { modules: Object.fromEntries(modules.map(n => [n.id, n])), connections }; }
function render(p) { const r = new WorkletRuntime({ sampleRate: 1000 }); r.applyGraph(compilePatchGraph(p), 1); return r; }
const energy = b => b.left.reduce((s, v) => s + v * v, 0);
beforeEach(() => { clearModuleRegistry(); registerCoreModuleTypes(); });

test('ADSR gate and VCA route shape audio and retain the release tail', () => {
  const r = render(patch([
    m('note', 'core.note-input'), m('osc', 'core.oscillator', 'voice', { waveform: 0 }),
    m('env', 'core.adsr', 'voice', { attack: 0.1, decay: 0.01, sustain: 1, release: 0.1 }),
    m('vca', 'core.vca', 'voice'), m('sum', 'core.voice-sum'), m('out', 'core.master-output')
  ], [c('p', 'note', 'pitchOut', 'osc', 'pitchIn'), c('g', 'note', 'gateOut', 'env', 'gateIn'),
    c('a', 'osc', 'audioOut', 'vca', 'audioIn'), c('e', 'env', 'controlOut', 'vca', 'gainIn'),
    c('s', 'vca', 'audioOut', 'sum', 'audioIn'), c('o', 'sum', 'audioOut', 'out', 'audioIn')]));
  r.handleNote({ type: 'note-on', note: 48, velocity: 1 });
  const attack = energy(r.processBlock(20));
  r.processBlock(100);
  expect(energy(r.processBlock(20))).toBeGreaterThan(attack * 5);
  r.handleNote({ type: 'note-off', note: 48 });
  expect(energy(r.processBlock(20))).toBeGreaterThan(0);
  r.processBlock(100);
  expect(energy(r.processBlock(20))).toBe(0);
});

test('LFO modulation changes the rendered oscillator, not just graph metadata', () => {
  const p = patch([m('lfo', 'core.lfo', 'global', { rate: 5 }), m('osc', 'core.oscillator'), m('out', 'core.master-output')],
    [c('a', 'osc', 'audioOut', 'out', 'audioIn'), c('fm', 'lfo', 'controlOut', 'osc', 'fmIn')]);
  const modulated = render(p).processBlock(200).left;
  p.connections.pop();
  expect(modulated).not.toEqual(render(p).processBlock(200).left);
});

test('voice sum gain affects actual output', () => {
  const p = patch([m('osc', 'core.oscillator', 'voice'), m('sum', 'core.voice-sum', 'global', { gain: 0 }), m('out', 'core.master-output')],
    [c('a', 'osc', 'audioOut', 'sum', 'audioIn'), c('b', 'sum', 'audioOut', 'out', 'audioIn')]);
  const r = render(p); r.handleNote({ type: 'note-on', note: 60 });
  expect(energy(r.processBlock(100))).toBe(0);
});

test('save/load preserves patch metadata, module UI, and modulation settings', () => {
  const p = patch([m('lfo', 'core.lfo'), m('osc', 'core.oscillator')], [c('fm', 'lfo', 'controlOut', 'osc', 'fmIn')]);
  Object.assign(p, { id: 'custom', tags: ['test'], transport: { bpm: 97 }, automation: [{ id: 'curve' }], extensions: { vendor: { data: 7 } }, ui: { zoom: 2 } });
  p.modules.osc.ui = { collapsed: true }; p.modules.osc.position = { x: 15, y: 20 };
  p.connections[0].modulation = { amount: 7, polarity: 'bipolar' };
  const restored = parsePatch(serializePatch(p));
  expect(restored).toMatchObject({ id: p.id, tags: p.tags, transport: p.transport, automation: p.automation, extensions: p.extensions, ui: p.ui });
  expect(restored.modules.osc.ui.collapsed).toBe(true);
  expect(restored.connections[0].modulation).toEqual(p.connections[0].modulation);
});

test('panic cancels events already extracted for the same processing range', () => {
  const e = new VoiceEngine();
  e.enqueue({ type: 'panic', frame: 0 }); e.enqueue({ type: 'note-on', note: 60, frame: 1 });
  e.processRange(0, 128); expect(e.voices()).toEqual([]);
});

test('malformed or unsupported note events cannot crash the processor', () => {
  const r = render(patch([m('osc', 'core.oscillator')], []));
  expect(r.handleNote({ type: 'wat' })).toBe(false);
  expect(r.handleNote({ type: 'note-on', note: NaN })).toBe(false);
  expect(() => r.processBlock(8)).not.toThrow();
});

test('concurrent starts create only one worklet node', async () => {
  let count = 0;
  const context = { state: 'running', destination: {}, audioWorklet: { addModule: async () => {} } };
  const e = new AudioEngine({ contextFactory: () => context, nodeFactory: () => { count++; return { port: { postMessage() {} }, connect() {} }; } });
  await Promise.all([e.start(), e.start()]); expect(count).toBe(1);
});

test('keyup releases a held note even after focus moves to an editable control', () => {
  const events = []; const handlers = {};
  const k = new ComputerKeyboardInput({ onEvent: e => events.push(e) });
  k.attach({ addEventListener: (name, fn) => handlers[name] = fn });
  handlers.keydown({ code: 'KeyA', target: { tagName: 'DIV' } });
  handlers.keyup({ code: 'KeyA', target: { tagName: 'INPUT' } });
  expect(events.map(e => e.type)).toEqual(['note-on', 'note-off']);
});

test('unchanged oscillator phase survives graph swaps', () => {
  const p = patch([m('osc', 'core.oscillator', 'global', { waveform: 0 }), m('out', 'core.master-output')], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  const continuous = render(p); const swapped = render(p);
  continuous.processBlock(37); swapped.processBlock(37);
  swapped.applyGraph(compilePatchGraph(p), 2);
  expect(swapped.processBlock(40).left).toEqual(continuous.processBlock(40).left);
});

test('polyphony control limits the running allocator', () => {
  const r = render(patch([m('note', 'core.note-input', 'global', { maxVoices: 2 })], []));
  for (let note = 60; note < 65; note++) r.handleNote({ type: 'note-on', note });
  r.processBlock(1); expect(r.diagnostics().activeVoices).toBe(2);
  r.setParameter('note', 'maxVoices', 1); expect(r.diagnostics().activeVoices).toBe(1);
});

test('disabled cables do not transmit sound', () => {
  const p = patch([m('osc', 'core.oscillator'), m('out', 'core.master-output')], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  p.connections[0].enabled = false;
  expect(energy(render(p).processBlock(64))).toBe(0);
});

test('muted modules do not transmit sound', () => {
  const p = patch([m('osc', 'core.oscillator'), m('out', 'core.master-output')], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  p.modules.osc.muted = true;
  expect(energy(render(p).processBlock(64))).toBe(0);
});

test('master output remains bounded under excessive internal gain', () => {
  const p = patch([m('osc', 'core.oscillator', 'global', { amplitude: 1 }), m('out', 'core.master-output', 'global', { gain: 1.5 })], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  const r = render(p); r.setParameter('__master__', 'gain', 1.5);
  expect([...r.processBlock(200).left].every(v => Number.isFinite(v) && Math.abs(v) <= 1)).toBe(true);
});

test('panic flushes delay history before the next note', () => {
  const p = patch([m('osc', 'core.oscillator'), m('delay', 'core.delay', 'global', { time: 0.02, mix: 1 }), m('out', 'core.master-output')],
    [c('a', 'osc', 'audioOut', 'delay', 'audioIn'), c('b', 'delay', 'audioOut', 'out', 'audioIn')]);
  const r = render(p); r.processBlock(100); r.panic(); r.setParameter('osc', 'amplitude', 0);
  r.handleNote({ type: 'note-on', note: 60 });
  expect(energy(r.processBlock(100))).toBe(0);
});

test('invalid graph shapes report validation errors without throwing', async () => {
  const { validatePatchGraph } = await import('../../src/graph/validate.js');
  for (const p of [null, { modules: [] }, { modules: { bad: null } }, { modules: {}, connections: [null] }]) {
    expect(validatePatchGraph(p).valid).toBe(false);
  }
});

test('null protocol payloads cannot throw inside the processor', () => {
  const r = new WorkletRuntime();
  for (const type of ['graphSwap', 'parameter', 'note']) expect(r.handleMessage({ type, payload: null }).ok).toBe(false);
});

test('patch imports reject duplicate connection IDs and fractional choices', () => {
  const p = patch([m('osc', 'core.oscillator'), m('out', 'core.master-output')], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  const d = JSON.parse(serializePatch(p)); d.connections.push(d.connections[0]);
  expect(() => parsePatch(JSON.stringify(d))).toThrow(/duplicate/i);
  d.connections.pop(); d.modules.find(n => n.id === 'osc').parameters.waveform = 1.5;
  expect(() => parsePatch(JSON.stringify(d))).toThrow(/integer/i);
});

test('module UI does not overwrite a newer layout position on export', () => {
  const p = patch([m('osc', 'core.oscillator')], []);
  p.modules.osc.position = { x: 100, y: 200 }; p.modules.osc.ui = { x: 1, y: 2, collapsed: true };
  expect(parsePatch(serializePatch(p)).modules.osc.position).toEqual({ x: 100, y: 200 });
});

test('independent voice filters equal the sum of separately rendered voices', () => {
  const p = patch([m('note', 'core.note-input'), m('osc', 'core.oscillator', 'voice'), m('filter', 'core.filter', 'voice', { cutoff: 200, drive: 3 }), m('sum', 'core.voice-sum'), m('out', 'core.master-output')],
    [c('p', 'note', 'pitchOut', 'osc', 'pitchIn'), c('f', 'osc', 'audioOut', 'filter', 'audioIn'), c('s', 'filter', 'audioOut', 'sum', 'audioIn'), c('o', 'sum', 'audioOut', 'out', 'audioIn')]);
  const a = render(p), b = render(p), combined = render(p);
  a.handleNote({ type: 'note-on', note: 48, velocity: 0.5 }); b.handleNote({ type: 'note-on', note: 55, velocity: 0.5 });
  combined.handleNote({ type: 'note-on', note: 48, velocity: 0.5 }); combined.handleNote({ type: 'note-on', note: 55, velocity: 0.5 });
  const av = a.processBlock(100).left, bv = b.processBlock(100).left, cv = combined.processBlock(100).left;
  for (let i = 0; i < cv.length; i++) expect(cv[i]).toBeCloseTo((av[i] + bv[i]) / Math.sqrt(2), 6);
});

test('compiled continuous parameters ramp in the actual audio runtime', () => {
  const p = patch([m('osc', 'core.oscillator', 'global', { amplitude: 1 }), m('out', 'core.master-output')], [c('a', 'osc', 'audioOut', 'out', 'audioIn')]);
  const r = render(p); r.processBlock(20); r.setParameter('osc', 'amplitude', 0);
  expect(energy(r.processBlock(10))).toBeGreaterThan(0);
  r.processBlock(200);
  expect(energy(r.processBlock(10))).toBe(0);
});

test('processor faults disconnect the failed node and permit restart', async () => {
  let loads = 0; let disconnected = false; const nodes = [];
  const context = { state: 'running', destination: {}, audioWorklet: { addModule: async () => { loads++; } } };
  const e = new AudioEngine({ contextFactory: () => context, nodeFactory: () => {
    const node = { port: { postMessage() {} }, connect() {}, disconnect() { disconnected = true; } }; nodes.push(node); return node;
  } });
  await e.start(); nodes[0].onprocessorerror();
  expect(e.diagnostics().started).toBe(false); expect(disconnected).toBe(true);
  await e.start(); expect(e.diagnostics().started).toBe(true); expect(nodes).toHaveLength(2); expect(loads).toBe(1);
});
