import { describe, expect, test } from 'vitest';
import { MultiStageEnvelope } from '../../src/dsp/mseg.js';

describe('MultiStageEnvelope',()=>{
  test('interpolates editable points and reaches final stage',()=>{
    const env=new MultiStageEnvelope({sampleRate:1000,points:[{time:0,value:0},{time:.01,value:1},{time:.02,value:.25}],loop:false});
    env.gateOn();
    const out=env.renderBlock(25);
    expect(out[0]).toBeGreaterThanOrEqual(0);
    expect(Math.max(...out)).toBeGreaterThan(.9);
    expect(out.at(-1)).toBeCloseTo(.25,2);
  });
  test('loops the declared range while gate remains high',()=>{
    const env=new MultiStageEnvelope({sampleRate:1000,points:[{time:0,value:0},{time:.005,value:1},{time:.01,value:0}],loop:true});
    env.gateOn();
    const out=env.renderBlock(35);
    expect(Math.max(...out)).toBeGreaterThan(.8);
    expect([...out].every(Number.isFinite)).toBe(true);
  });
});
