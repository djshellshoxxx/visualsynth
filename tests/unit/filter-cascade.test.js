import { describe, expect, test } from 'vitest';
import { FilterCascade } from '../../src/dsp/filters.js';

describe('FilterCascade',()=>{
  test.each([12,24,36,48])('supports %d dB/oct slopes with finite output',slope=>{
    const filter=new FilterCascade({sampleRate:48000,cutoff:1200,resonance:.4,mode:'lowpass',slope,drive:.5,wet:1});
    const output=Array.from({length:4096},(_,i)=>filter.processSample(i===0?1:0));
    expect(output.every(Number.isFinite)).toBe(true);
    expect(Math.max(...output.map(Math.abs))).toBeLessThanOrEqual(4);
  });
  test('wet zero is bit-transparent apart from safety sanitization',()=>{
    const filter=new FilterCascade({sampleRate:48000,cutoff:500,resonance:.8,mode:'highpass',slope:48,wet:0});
    const values=[-.7,-.1,0,.2,.8];
    expect(values.map(v=>filter.processSample(v))).toEqual(values);
  });
});
