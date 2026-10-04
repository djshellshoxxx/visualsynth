import { describe, expect, test } from 'vitest';
import { EngineMessageType, createEngineMessage, validateEngineMessage } from '../../src/engine/protocol.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

function simpleGraph(revision = 1) {
  return {
    formatVersion: 1,
    revision,
    nodes: [
      { index: 0, id: 'osc', type: 'core.oscillator', scope: 'global', parameters: { waveform: 0, amplitude: 0.25 }, ports: [] },
      { index: 1, id: 'master', type: 'core.master-output', scope: 'global', parameters: { gain: 0.8 }, ports: [] }
    ],
    connections: [
      { id: 'c1', from: { moduleId: 'osc', portId: 'audioOut' }, to: { moduleId: 'master', portId: 'audioIn' } }
    ]
  };
}

describe('engine protocol', () => {
  test('creates and validates canonical messages', () => {
    const message = createEngineMessage(EngineMessageType.GRAPH_SWAP, { revision: 3, graph: simpleGraph(3) });
    expect(message.type).toBe('graphSwap');
    expect(message.payload.revision).toBe(3);
    expect(validateEngineMessage(message)).toEqual({ valid: true, errors: [] });
  });

  test('rejects malformed and unknown messages', () => {
    expect(validateEngineMessage(null).valid).toBe(false);
    expect(validateEngineMessage({ type: 'wat', payload: {} }).valid).toBe(false);
    expect(() => createEngineMessage('wat', {})).toThrow(/unknown/i);
  });
});

describe('WorkletRuntime', () => {
  test('accepts monotonic graph revisions and rejects stale swaps', () => {
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    expect(runtime.applyGraph(simpleGraph(2), 2)).toBe(true);
    expect(runtime.revision).toBe(2);
    expect(runtime.applyGraph(simpleGraph(1), 1)).toBe(false);
    expect(runtime.revision).toBe(2);
  });

  test('renders finite output from an accepted graph', () => {
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph(simpleGraph(1), 1);
    const block = runtime.processBlock(128);
    expect(block.left).toHaveLength(128);
    expect(block.right).toHaveLength(128);
    expect([...block.left, ...block.right].every(Number.isFinite)).toBe(true);
    expect(block.left.some(sample => Math.abs(sample) > 0)).toBe(true);
  });

  test('parameter-only updates do not change graph revision', () => {
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph(simpleGraph(4), 4);
    expect(runtime.setParameter('osc', 'amplitude', 0.1)).toBe(true);
    expect(runtime.revision).toBe(4);
    expect(runtime.diagnostics().parameterUpdates).toBe(1);
  });

  test('panic clears active voices and returns silence until new activity', () => {
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph(simpleGraph(1), 1);
    runtime.handleNote({ type: 'note-on', note: 60, velocity: 1, frame: 0 });
    runtime.panic(1);
    expect(runtime.diagnostics().activeVoices).toBe(0);
    const block = runtime.processBlock(32);
    expect(block.left.every(sample => sample === 0)).toBe(true);
    expect(block.right.every(sample => sample === 0)).toBe(true);
  });
});
