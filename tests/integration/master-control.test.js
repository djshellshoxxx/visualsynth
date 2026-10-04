import { describe, expect, test } from 'vitest';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

function graph() {
  return {
    formatVersion: 1,
    revision: 1,
    nodes: [
      { index: 0, id: 'osc', type: 'core.oscillator', scope: 'global', parameters: { waveform: 0, amplitude: 0.5 }, ports: [] },
      { index: 1, id: 'out', type: 'core.master-output', scope: 'global', parameters: { gain: 1 }, ports: [] }
    ],
    connections: [{ id: 'c1', from: { moduleId: 'osc', portId: 'audioOut' }, to: { moduleId: 'out', portId: 'audioIn' } }]
  };
}

describe('engine-level master gain', () => {
  test('attenuates output independently of the patch master module', () => {
    const reference = new WorkletRuntime({ sampleRate: 48000 });
    reference.applyGraph(graph(), 1);
    const full = reference.processBlock(64);

    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph(graph(), 1);
    expect(runtime.setParameter('__master__', 'gain', 0.25)).toBe(true);
    const quiet = runtime.processBlock(64);

    const fullPeak = Math.max(...full.left.map(Math.abs));
    const quietPeak = Math.max(...quiet.left.map(Math.abs));
    expect(quietPeak).toBeGreaterThan(0);
    expect(quietPeak).toBeLessThan(fullPeak * 0.3);
  });

  test('mute gain of zero produces silence without altering graph revision', () => {
    const runtime = new WorkletRuntime({ sampleRate: 48000 });
    runtime.applyGraph(graph(), 7);
    runtime.setParameter('__master__', 'gain', 0);
    const block = runtime.processBlock(32);
    expect(block.left.every(sample => sample === 0)).toBe(true);
    expect(runtime.revision).toBe(7);
  });
});
