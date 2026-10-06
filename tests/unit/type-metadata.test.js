import { describe, expect, test } from 'vitest';
import { SignalType, defineParameter } from '../../src/graph/types.js';

describe('graph metadata',()=>{
  test('includes transport clock as a first-class signal type',()=>expect(SignalType.CLOCK).toBe('clock'));
  test('normalizes automation, MIDI, safe-range, display and education metadata',()=>{
    const p=defineParameter({id:'cutoff',min:20,max:20000,defaultValue:1000,unit:'Hz',automatable:false,midiMappable:false,safeMin:40,safeMax:12000,rate:'control',formatter:'frequency',help:'Filter cutoff'});
    expect(p).toMatchObject({automatable:false,midiMappable:false,safeMin:40,safeMax:12000,rate:'control',formatter:'frequency',help:'Filter cutoff'});
  });
});
