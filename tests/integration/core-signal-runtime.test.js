import { beforeEach, describe, expect, test } from 'vitest';
import { clearModuleRegistry } from '../../src/graph/registry.js';
import { registerCoreModuleTypes } from '../../src/modules/core-definitions.js';
import { compilePatchGraph } from '../../src/graph/compile.js';
import { WorkletRuntime } from '../../src/engine/worklet-processor.js';

const mod=(id,type,scope,parameters={})=>({id,type,scope,moduleVersion:1,position:{x:0,y:0},parameters});
const edge=(id,a,ap,b,bp,modulation)=>({id,from:{moduleId:a,portId:ap},to:{moduleId:b,portId:bp},...(modulation?{modulation}:{})});

function playablePatch(){
  const modules=[
    mod('notes','core.note-input','global',{maxVoices:8,transpose:0}),
    mod('osc','core.oscillator','voice',{waveform:0,amplitude:.4,pulseWidth:.5,octave:0,semitone:0,cents:0}),
    mod('env','core.adsr','voice',{attack:.002,decay:.004,sustain:.55,release:.01}),
    mod('vca','core.vca','voice',{gain:1}),
    mod('sum','core.voice-sum','global',{gain:1}),
    mod('master','core.master-output','global',{gain:.8})
  ];
  return {formatVersion:1,name:'core runtime',modules:Object.fromEntries(modules.map(m=>[m.id,m])),connections:[
    edge('pitch','notes','pitchOut','osc','pitchIn'),
    edge('gate','notes','gateOut','env','gateIn'),
    edge('audio','osc','audioOut','vca','audioIn'),
    edge('gain','env','controlOut','vca','gainIn',{amount:1,polarity:'unipolar'}),
    edge('sum','vca','audioOut','sum','audioIn'),
    edge('master','sum','audioOut','master','audioIn')
  ],settings:{}};
}

describe('core signal runtime',()=>{
  beforeEach(()=>{clearModuleRegistry();registerCoreModuleTypes();});

  test('ADSR shapes each voice through the VCA and releases to silence',()=>{
    const runtime=new WorkletRuntime({sampleRate:48000,maxVoices:8});
    runtime.applyGraph({...compilePatchGraph(playablePatch()),revision:1},1);
    runtime.handleNote({type:'note-on',note:60,velocity:1,frame:0});
    const attack=runtime.processBlock(512).left;
    expect(Math.max(...attack.map(Math.abs))).toBeGreaterThan(.02);
    runtime.handleNote({type:'note-off',note:60,velocity:0,frame:runtime.currentFrame});
    const release=runtime.processBlock(2048).left;
    expect(Math.abs(release.at(-1))).toBeLessThan(.002);
  });

  test('polyphonic voices keep independent envelopes',()=>{
    const runtime=new WorkletRuntime({sampleRate:48000,maxVoices:8});
    runtime.applyGraph({...compilePatchGraph(playablePatch()),revision:1},1);
    runtime.handleNote({type:'note-on',note:60,velocity:1,frame:0});
    runtime.processBlock(128);
    runtime.handleNote({type:'note-on',note:67,velocity:.8,frame:runtime.currentFrame});
    runtime.processBlock(128);
    runtime.handleNote({type:'note-off',note:60,velocity:0,frame:runtime.currentFrame});
    const overlap=runtime.processBlock(1024).left;
    expect(Math.max(...overlap.map(Math.abs))).toBeGreaterThan(.01);
    expect(runtime.diagnostics().activeVoices).toBeGreaterThanOrEqual(1);
  });
});
