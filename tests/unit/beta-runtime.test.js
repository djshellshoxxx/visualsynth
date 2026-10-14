import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { registerBetaModuleTypes } from '../../src/modules/beta-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

const mod=(id,type,scope,parameters={})=>({id,type,scope,moduleVersion:1,position:{x:0,y:0},parameters});
const cable=(id,a,ap,b,bp)=>({id,from:{moduleId:a,portId:ap},to:{moduleId:b,portId:bp}});
function patch(type,parameters){
  const modules=[mod('osc','core.oscillator','global',{waveform:0,frequency:220,amplitude:.3,pulseWidth:.5}),mod('fx',type,'global',parameters),mod('master','core.master-output','global',{gain:.8})];
  return {formatVersion:1,name:'beta runtime',modules:Object.fromEntries(modules.map(m=>[m.id,m])),connections:[cable('a','osc','audioOut','fx','audioIn'),cable('b','fx','audioOut','master','audioIn')],settings:{}};
}
describe('beta runtime parameter updates',()=>{
  beforeEach(()=>{clearModuleRegistry();registerCoreModuleTypes();registerBetaModuleTypes();});
  test.each([
    ['beta.chorus',{rate:.2,depth:.3,feedback:.1,mix:.2},'mix',.9],
    ['beta.phaser',{rate:.2,depth:.3,feedback:.1,mix:.2},'depth',.9],
    ['beta.reverb',{size:.5,decay:2,damping:.4,preDelay:.01,mix:.2},'mix',.8],
    ['beta.eq',{frequency:800,gain:0,q:1},'gain',12],
    ['beta.compressor',{threshold:-18,ratio:4,attack:.01,release:.2,makeup:0},'ratio',10]
  ])('%s accepts live parameter updates without graph recompilation',(type,params,param,value)=>{
    const runtime=new WorkletRuntime({sampleRate:48000});
    const graph=compilePatchGraph(patch(type,params));
    runtime.applyGraph({...graph,revision:1},1);
    const swaps=runtime.diagnostics().graphSwaps;
    expect(runtime.setParameter('fx',param,value)).toBe(true);
    expect(runtime.diagnostics().graphSwaps).toBe(swaps);
    const block=runtime.processBlock(256);
    expect(Array.from(block.left).every(Number.isFinite)).toBe(true);
  });
});
