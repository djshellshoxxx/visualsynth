import { describe, expect, test, vi } from 'vitest';
import { VisualizationScheduler } from '../../src/visual/scheduler.js';
import { TelemetryBuffer } from '../../src/visual/telemetry.js';
import { decimateWaveform } from '../../src/visual/waveform.js';
import { spectrumMagnitudes } from '../../src/visual/spectrum.js';

describe('VisualizationScheduler', () => {
  test('updates all registered views from one frame call according to priority', () => {
    const high = vi.fn();
    const low = vi.fn();
    const scheduler = new VisualizationScheduler({ rates: { high: 60, normal: 30, low: 10 } });
    scheduler.register(high, 'high');
    scheduler.register(low, 'low');
    scheduler.frame(0);
    scheduler.frame(20);
    scheduler.frame(40);
    scheduler.frame(120);
    expect(high.mock.calls.length).toBeGreaterThan(low.mock.calls.length);
    expect(low.mock.calls.length).toBeGreaterThan(0);
  });

  test('throttles hidden views and supports freeze without dropping registration', () => {
    const view = vi.fn();
    const scheduler = new VisualizationScheduler({ rates: { high: 60, normal: 30, low: 10 }, hiddenRate: 1 });
    const id = scheduler.register(view, 'high');
    scheduler.frame(0);
    scheduler.setVisibility(id, false);
    scheduler.frame(100);
    scheduler.frame(500);
    expect(view).toHaveBeenCalledTimes(1);
    scheduler.freeze(true);
    scheduler.frame(2000);
    expect(view).toHaveBeenCalledTimes(1);
    scheduler.freeze(false);
    scheduler.frame(2100);
    expect(view).toHaveBeenCalledTimes(2);
  });

  test('degrades low priority views first when frame budget is exceeded', () => {
    const scheduler = new VisualizationScheduler({ frameBudgetMs: 1, now: () => 10 });
    const calls = [];
    scheduler.register(() => calls.push('high'), 'high');
    scheduler.register(() => calls.push('low'), 'low');
    scheduler.frame(100, { frameStart: 0 });
    expect(calls).toContain('high');
    expect(calls).not.toContain('low');
    expect(scheduler.diagnostics().degradedFrames).toBe(1);
  });
});

describe('TelemetryBuffer', () => {
  test('keeps a bounded newest-first history', () => {
    const buffer = new TelemetryBuffer({ capacity: 3 });
    buffer.push({ frame: 1 });
    buffer.push({ frame: 2 });
    buffer.push({ frame: 3 });
    buffer.push({ frame: 4 });
    expect(buffer.size).toBe(3);
    expect(buffer.latest()).toEqual({ frame: 4 });
    expect(buffer.toArray().map(item => item.frame)).toEqual([2, 3, 4]);
  });
});

describe('visual signal helpers', () => {
  test('decimates a waveform into bounded min/max buckets', () => {
    const source = Float32Array.from([0, 1, -1, 0.5, -0.5, 0]);
    const buckets = decimateWaveform(source, 3);
    expect(buckets).toHaveLength(3);
    expect(buckets[0]).toEqual({ min: 0, max: 1 });
    expect(buckets.every(bucket => bucket.min >= -1 && bucket.max <= 1)).toBe(true);
  });

  test('computes finite normalized spectrum magnitudes', () => {
    const signal = Float32Array.from({ length: 32 }, (_, i) => Math.sin(2 * Math.PI * i / 8));
    const spectrum = spectrumMagnitudes(signal, 8);
    expect(spectrum).toHaveLength(8);
    expect(spectrum.every(Number.isFinite)).toBe(true);
    expect(Math.max(...spectrum)).toBeLessThanOrEqual(1);
    expect(Math.max(...spectrum)).toBeGreaterThan(0.5);
  });
});
