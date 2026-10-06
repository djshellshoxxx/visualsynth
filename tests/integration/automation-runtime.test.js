import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

describe('automation playback',()=>{
  beforeEach(()=>{clearModuleRegistry();registerCoreModuleTypes();});
  test('interpolates parameter automation in engine sample frames',()=>{
    const patch={formatVersion:1,name:'automation',modules:{
      osc:{id:'osc',type:'core.oscillator',scope:'global',moduleVersion:1,position:{x:0,y:0},parameters:{waveform:0,frequency:440,amplitude:0,pulseWidth:.5}},
      master:{id:'master',type:'core.master-output',scope:'global',moduleVersion:1,position:{x:0,y:0},parameters:{gain:1}}
    },connections:[{id:'c',from:{moduleId:'osc',portId:'audioOut'},to:{moduleId:'master',portId:'audioIn'}}],settings:{},automation:[
      {id:'a',moduleId:'osc',parameterId:'amplitude',points:[{frame:0,value:0},{frame:200,value:1}]}
    ]};
    const runtime=new WorkletRuntime({sampleRate:48000});
    runtime.applyGraph({...compilePatchGraph(patch),revision:1},1);
    const out=runtime.processBlock(240).left;
    const early=Math.max(...out.slice(0,40).map(Math.abs));
    const late=Math.max(...out.slice(200).map(Math.abs));
    expect(late).toBeGreaterThan(early+.25);
  });
});
