import { describe, expect, test } from 'vitest';
import { NoiseGenerator } from '../../src/dsp/noise.js';

describe('NoiseGenerator', () => {
  test('is deterministic for the same seed', () => {
    const a = new NoiseGenerator({ seed: 1234, type: 'white' });
    const b = new NoiseGenerator({ seed: 1234, type: 'white' });
    const left = Array.from({ length: 64 }, () => a.nextSample());
    const right = Array.from({ length: 64 }, () => b.nextSample());
    expect(left).toEqual(right);
  });

  test('different seeds create different sequences', () => {
    const a = new NoiseGenerator({ seed: 1 });
    const b = new NoiseGenerator({ seed: 2 });
    expect(Array.from({ length: 16 }, () => a.nextSample())).not.toEqual(Array.from({ length: 16 }, () => b.nextSample()));
  });

  test('white pink and brown modes remain finite and bounded', () => {
    for (const type of ['white', 'pink', 'brown', 'blue']) {
      const noise = new NoiseGenerator({ seed: 99, type });
      for (let index = 0; index < 4096; index += 1) {
        const sample = noise.nextSample();
        expect(Number.isFinite(sample)).toBe(true);
        expect(Math.abs(sample)).toBeLessThanOrEqual(1);
      }
    }
  });

  test('reset reproduces the seeded sequence', () => {
    const noise = new NoiseGenerator({ seed: 42 });
    const first = Array.from({ length: 12 }, () => noise.nextSample());
    noise.reset();
    expect(Array.from({ length: 12 }, () => noise.nextSample())).toEqual(first);
  });
});
