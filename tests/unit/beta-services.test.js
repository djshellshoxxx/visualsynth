import { describe, expect, test } from 'vitest';
import { MidiLearnMap } from '../../src/input/midi-learn.js';
import { traceSignalPath, compareSnapshots } from '../../src/analysis/signal-tools.js';
import { OfflineRenderer } from '../../src/render/offline-renderer.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';

describe('MIDI learn', () => {
  test('maps CC through min/max/invert/curve', () => {
    const map = new MidiLearnMap();
    map.bind({ controller: 74, moduleId: 'filter', parameterId: 'cutoff', min: 100, max: 8100, invert: true, curve: 'linear' });
    expect(map.apply({ type: 'cc', controller: 74, value: 0 })).toEqual(expect.objectContaining({ moduleId: 'filter', parameterId: 'cutoff', value: 8100 }));
    expect(map.apply({ type: 'cc', controller: 74, value: 1 }).value).toBe(100);
  });
});

describe('signal tools', () => {
  test('traces a real source-to-master route without changing the graph', () => {
    const patch={ modules:{a:{id:'a',type:'core.oscillator'},b:{id:'b',type:'core.voice-sum'},m:{id:'m',type:'core.master-output'}}, connections:[
      {id:'1',from:{moduleId:'a',portId:'audioOut'},to:{moduleId:'b',portId:'audioIn'}},
      {id:'2',from:{moduleId:'b',portId:'audioOut'},to:{moduleId:'m',portId:'audioIn'}}
    ]};
    expect(traceSignalPath(patch,'a','m')).toEqual(['a','b','m']);
  });

  test('compares parameter snapshots', () => {
    expect(compareSnapshots({cutoff:1000,mix:.2},{cutoff:2000,mix:.2})).toEqual([{ parameterId:'cutoff', a:1000, b:2000 }]);
  });
});

describe('offline renderer', () => {
  test('renders the same GraphIR runtime to finite WAV data', async () => {
    clearModuleRegistry(); registerCoreModuleTypes();
    const modules=[
      {id:'osc',type:'core.oscillator',scope:'global',moduleVersion:1,position:{x:0,y:0},parameters:{waveform:0,frequency:220,amplitude:.1,pulseWidth:.5}},
      {id:'master',type:'core.master-output',scope:'global',moduleVersion:1,position:{x:0,y:0},parameters:{gain:.8}}
    ];
    const patch={formatVersion:1,name:'offline',modules:Object.fromEntries(modules.map(m=>[m.id,m])),connections:[{id:'c',from:{moduleId:'osc',portId:'audioOut'},to:{moduleId:'master',portId:'audioIn'}}],settings:{}};
    const renderer=new OfflineRenderer();
    const result=await renderer.render(compilePatchGraph(patch),{durationSeconds:.02,sampleRate:48000,format:'pcm16'});
    expect(result.frames).toBe(960);
    expect(new Uint8Array(result.wav).length).toBeGreaterThan(44);
    expect(result.peak).toBeGreaterThan(0);
  });
});
