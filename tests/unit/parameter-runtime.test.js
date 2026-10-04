import { describe, expect, test } from 'vitest';
import { ParameterRuntime, normalizedToParameterValue, parameterValueToNormalized } from '../../src/engine/parameter-runtime.js';

const linear = { id: 'gain', min: 0, max: 1, defaultValue: 0, curve: 'linear', smoothingMs: 10 };
const log = { id: 'cutoff', min: 20, max: 20000, defaultValue: 200, curve: 'log', smoothingMs: 0 };

describe('parameter value conversion', () => {
  test('linear conversion maps endpoints and midpoint', () => {
    expect(normalizedToParameterValue(linear, 0)).toBe(0);
    expect(normalizedToParameterValue(linear, 0.5)).toBe(0.5);
    expect(normalizedToParameterValue(linear, 1)).toBe(1);
    expect(parameterValueToNormalized(linear, 0.25)).toBeCloseTo(0.25, 8);
  });

  test('log conversion maps geometric midpoint and round trips', () => {
    expect(normalizedToParameterValue(log, 0)).toBeCloseTo(20, 8);
    expect(normalizedToParameterValue(log, 0.5)).toBeCloseTo(Math.sqrt(20 * 20000), 6);
    expect(normalizedToParameterValue(log, 1)).toBeCloseTo(20000, 8);
    expect(parameterValueToNormalized(log, 2000)).toBeCloseTo(Math.log(100) / Math.log(1000), 6);
  });
});

describe('ParameterRuntime', () => {
  test('no smoothing applies target immediately at the requested frame', () => {
    const runtime = new ParameterRuntime({ ...linear, smoothingMs: 0 }, 1000);
    runtime.setTarget('gain', 0.75, 4);
    const block = runtime.renderBlock(0, 8);
    expect(block.slice(0, 4)).toEqual(new Float32Array([0, 0, 0, 0]));
    expect([...block.slice(4)]).toEqual([0.75, 0.75, 0.75, 0.75]);
  });

  test('one-pole smoothing starts exactly on target frame and approaches target monotonically', () => {
    const runtime = new ParameterRuntime(linear, 1000);
    runtime.setTarget('gain', 1, 2);
    const block = runtime.renderBlock(0, 20);
    expect(block[0]).toBe(0);
    expect(block[1]).toBe(0);
    expect(block[2]).toBeGreaterThan(0);
    expect(block[2]).toBeLessThan(1);
    for (let i = 3; i < block.length; i += 1) expect(block[i]).toBeGreaterThanOrEqual(block[i - 1]);
    expect(block.at(-1)).toBeLessThan(1);
  });

  test('targets are clamped and non-finite targets fail safely', () => {
    const runtime = new ParameterRuntime(linear, 48000);
    runtime.setTarget('gain', 10, 0);
    const high = runtime.renderBlock(0, 1);
    expect(high[0]).toBeLessThanOrEqual(1);

    runtime.setTarget('gain', Number.NaN, 1);
    const next = runtime.renderBlock(1, 1);
    expect(Number.isFinite(next[0])).toBe(true);
  });

  test('multiple queued target changes are processed in frame order', () => {
    const runtime = new ParameterRuntime({ ...linear, smoothingMs: 0 }, 48000);
    runtime.setTarget('gain', 0.25, 1);
    runtime.setTarget('gain', 0.75, 3);
    const block = runtime.renderBlock(0, 5);
    expect([...block]).toEqual([0, 0.25, 0.25, 0.75, 0.75]);
  });
});
