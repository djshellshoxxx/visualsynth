import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { validatePatchGraph } from '../../src/graph/validate.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

const mod=(id,type,parameters={})=>({id,type,scope:'global',moduleVersion:1,position:{x:0,y:0},parameters});
const edge=(id,a,b)=>({id,from:{moduleId:a,portId:'audioOut'},to:{moduleId:b,portId:'audioIn'}});

describe('causal feedback cycles',()=>{
  beforeEach(()=>{clearModuleRegistry();registerCoreModuleTypes();});

  test('accepts a loop only when Feedback Delay breaks the zero-delay cycle',()=>{
    const modules={
      osc:mod('osc','core.oscillator',{waveform:0,frequency:220,amplitude:.1,pulseWidth:.5}),
      mix:mod('mix','core.mixer',{gain:.5}),
      fb:mod('fb','core.feedback-delay',{samples:1,feedback:.4}),
      master:mod('master','core.master-output',{gain:.8})
    };
    const patch={formatVersion:1,name:'feedback',modules,connections:[
      edge('a','osc','mix'),edge('b','mix','fb'),edge('c','fb','mix'),edge('d','mix','master')
    ],settings:{}};
    expect(validatePatchGraph(patch).valid).toBe(true);
    const graph=compilePatchGraph(patch);
    const runtime=new WorkletRuntime({sampleRate:48000});
    expect(runtime.applyGraph({...graph,revision:1},1)).toBe(true);
    const audio=runtime.processBlock(1024).left;
    expect([...audio].every(Number.isFinite)).toBe(true);
  });

  test('continues to reject an ordinary zero-delay loop',()=>{
    const modules={a:mod('a','core.mixer',{gain:.5}),b:mod('b','core.mixer',{gain:.5})};
    const patch={formatVersion:1,name:'bad',modules,connections:[edge('a','a','b'),edge('b','b','a')],settings:{}};
    expect(validatePatchGraph(patch).valid).toBe(false);
  });
});
