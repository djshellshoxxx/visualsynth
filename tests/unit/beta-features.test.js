import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createRegistry} from '../../src/graph/registry.js';
import {coreDefinitions} from '../../src/modules/core-definitions.js';
import {compilePatchGraph} from '../../src/graph/compile.js';

const registry=createRegistry(); for(const d of coreDefinitions) registry.register(d);

test('factory preset catalogue contains the planned MVP templates and every preset compiles', async()=>{
  const {factoryPresets}=await import('../../src/presets/factory.js');
  const expected=['Basic Subtractive','Two Oscillator Analog','Supersaw Lite','Bass','Lead','Pad','Noise Percussion','Educational Basic Signal Flow'];
  assert.deepEqual(factoryPresets.map(p=>p.name), expected);
  for(const preset of factoryPresets){
    const compiled=compilePatchGraph(preset.patch,registry);
    assert.ok(compiled.order.length>0, preset.name);
    assert.equal(preset.patch.modules.some(m=>m.type==='master'),true,preset.name);
  }
});

test('diagnostics document is bounded and excludes private path/url data', async()=>{
  const {DiagnosticsLog,collectDiagnostics}=await import('../../src/diagnostics/diagnostics.js');
  const log=new DiagnosticsLog(3); for(let i=0;i<5;i++) log.push('info',`event-${i}`,{url:'https://secret.invalid/x',path:'/Users/alice/file'});
  const doc=collectDiagnostics({engine:{diagnostics:()=>({started:true,state:'running',sampleRate:48000,baseLatency:.01,graphRevision:4})},patch:{modules:[1,2],connections:[1]},midi:{available:false,reason:'unsupported'},visualization:{activeViews:2,droppedFrames:1},log});
  assert.equal(doc.engine.sampleRate,48000); assert.equal(doc.patch.modules,2); assert.equal(doc.events.length,3);
  const raw=JSON.stringify(doc); assert.doesNotMatch(raw,/secret\.invalid|\/Users\/alice/);
});

test('compiled modulation connection amount and polarity alter graph runtime', async()=>{
  const {GraphRuntime}=await import('../../src/engine/graph-runtime.js');
  const make=(amount=0,polarity=1)=>({modules:[
    {id:'n',type:'note-input',params:{}},{id:'o',type:'oscillator',params:{waveform:'sine',level:.5}},{id:'l',type:'lfo',params:{rate:10,depth:1}},{id:'m',type:'master',params:{gain:1}}
  ],connections:[
    {id:'pitch',from:{module:'n',port:'pitch'},to:{module:'o',port:'pitch'}},
    {id:'mod',from:{module:'l',port:'control'},to:{module:'o',port:'fm'},amount,polarity},
    {id:'audio',from:{module:'o',port:'audio'},to:{module:'m',port:'audio'}}
  ]});
  const render=p=>{const rt=new GraphRuntime(48000);rt.setGraph(compilePatchGraph(p,registry));rt.note({type:'noteOn',note:60,velocity:1});const l=new Float32Array(2048),r=new Float32Array(2048);rt.process(l,r);return l};
  const neutral=render(make(0,1)), positive=render(make(1,1)), negative=render(make(1,-1));
  assert.deepEqual([...neutral], [...render(make(0,-1))]);
  assert.notDeepEqual([...neutral], [...positive]);
  assert.notDeepEqual([...positive], [...negative]);
});

test('shell includes preset, diagnostics and accessible live-status controls plus reduced-motion CSS',()=>{
  const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
  const css=fs.readFileSync(new URL('../../styles/app.css',import.meta.url),'utf8');
  for(const id of ['preset-select','copy-diagnostics','download-diagnostics','connection-list']) assert.match(html,new RegExp(`id=["']${id}["']`));
  assert.match(html,/aria-live=["']polite["']/);
  assert.match(css,/prefers-reduced-motion/);
});

test('GitHub Pages workflow exists and targets the visual synth static site',()=>{
  const yml=fs.readFileSync(new URL('../../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.match(yml,/pages/); assert.match(yml,/upload-pages-artifact/); assert.match(yml,/deploy-pages/);
});

test('oscillator exposes waveform choice metadata and workspace renders choice controls',()=>{
  const osc=coreDefinitions.find(x=>x.typeId==='oscillator');
  const wave=osc.parameters.find(x=>x.id==='waveform');
  assert.equal(wave.type,'choice');
  assert.ok(wave.options.includes('saw'));
  assert.ok(wave.options.includes('white-noise'));
  const src=fs.readFileSync(new URL('../../src/ui/workspace.js',import.meta.url),'utf8');
  assert.match(src,/createElement\('select'\)/);
});
