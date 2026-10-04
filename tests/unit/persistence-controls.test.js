import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {deserializePatch} from '../../src/persistence/patch-schema.js';
import {LFO} from '../../src/dsp/lfo.js';
import {coreDefinitions} from '../../src/modules/core-definitions.js';

test('legacy unwrapped patch documents migrate into current schema',()=>{
 const legacy={modules:[],connections:[],settings:{polyphony:4}};
 const migrated=deserializePatch(JSON.stringify(legacy));
 assert.equal(migrated.schemaVersion,1); assert.deepEqual(migrated.patch,legacy); assert.equal(migrated.migratedFrom,0);
});

test('LFO exposes multiple shapes and sample-hold remains stepped',()=>{
 const def=coreDefinitions.find(x=>x.typeId==='lfo'),wave=def.parameters.find(x=>x.id==='waveform');
 assert.ok(wave.options.includes('triangle')); assert.ok(wave.options.includes('sample-hold'));
 const sine=new LFO(100),square=new LFO(100),hold=new LFO(100);
 const s1=[...Array(20)].map(()=>sine.next({rate:5,depth:1,waveform:'sine'}));
 const s2=[...Array(20)].map(()=>square.next({rate:5,depth:1,waveform:'square'}));
 assert.notDeepEqual(s1,s2);
 const h=[...Array(5)].map(()=>hold.next({rate:1,depth:1,waveform:'sample-hold'}));
 assert.equal(new Set(h).size,1);
});

test('master monitor exposes volume and mute controls',()=>{
 const html=fs.readFileSync(new URL('../../index.html',import.meta.url),'utf8');
 assert.match(html,/id=["']master-volume["']/); assert.match(html,/id=["']master-mute["']/);
 const app=fs.readFileSync(new URL('../../src/app.js',import.meta.url),'utf8');
 assert.match(app,/master-volume/); assert.match(app,/master-mute/);
});
