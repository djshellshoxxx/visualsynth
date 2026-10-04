import {Oscillator} from '../dsp/oscillator.js';
import {ADSR} from '../dsp/envelope.js';
import {LFO} from '../dsp/lfo.js';
import {StateVariableFilter} from '../dsp/filters.js';
import {applyVCA} from '../dsp/vca.js';
import {sanitizeSample} from '../dsp/safety.js';
import {noteToHz} from '../dsp/math.js';

export class GraphRuntime{
 constructor(sampleRate=48000){this.sampleRate=sampleRate;this.graph=null;this.voices=new Map();this.globalState=new Map();this.paramOverrides=new Map();this.seq=0;this.incoming=new Map();this.moduleById=new Map();}
 get voiceCount(){return this.voices.size}
 setGraph(graph){this.graph=graph;this.moduleById=new Map(graph.modules.map(m=>[m.id,m]));this.incoming=new Map();for(const c of graph.connections){const key=`${c.to.module}:${c.to.port}`;const a=this.incoming.get(key)||[];a.push(c);this.incoming.set(key,a)}for(const m of graph.modules)if(m.type==='lfo'&&!this.globalState.has(m.id))this.globalState.set(m.id,{lfo:new LFO(this.sampleRate)});return graph.revision}
 setParameter(moduleId,paramId,value){this.paramOverrides.set(`${moduleId}:${paramId}`,value)}
 param(m,id,fallback){return this.paramOverrides.get(`${m.id}:${id}`)??m.params?.[id]??fallback}
 note(e){if(e.type==='noteOn'){this.voices.set(e.note,{id:`v${++this.seq}`,note:e.note,velocity:e.velocity??1,released:false,state:new Map()});return}if(e.type==='noteOff'){const v=this.voices.get(e.note);if(v)v.released=true}else if(e.type==='panic')this.voices.clear()}
 sourceValue(values,c){const raw=values.get(`${c.from.module}:${c.from.port}`)??0,amount=Number.isFinite(c.amount)?Math.max(-8,Math.min(8,c.amount)):1,polarity=c.polarity===-1?-1:1;return raw*amount*polarity}
 input(values,moduleId,port){let sum=0;for(const c of this.incoming.get(`${moduleId}:${port}`)||[])sum+=this.sourceValue(values,c);return sum}
 voiceState(v,m){let s=v.state.get(m.id);if(!s){s={};if(m.type==='oscillator')s.osc=new Oscillator(this.sampleRate);if(m.type==='adsr')s.env=new ADSR(this.sampleRate);if(m.type==='filter')s.filter=new StateVariableFilter(this.sampleRate);v.state.set(m.id,s)}return s}
 process(left,right){left.fill(0);right.fill(0);if(!this.graph)return{peak:0,rms:0,voices:0};let peak=0,sum=0;for(let i=0;i<left.length;i++){
   const globalValues=new Map();for(const id of this.graph.order){const m=this.moduleById.get(id);if(m?.type==='lfo'){const st=this.globalState.get(id),y=st.lfo.next({rate:this.param(m,'rate',2),depth:this.param(m,'depth',.5),waveform:this.param(m,'waveform','sine')});globalValues.set(`${id}:control`,y)}}
   let frame=0;const retire=[];
   for(const [note,v] of this.voices){const values=new Map(globalValues);for(const id of this.graph.order){const m=this.moduleById.get(id);if(!m||m.type==='lfo'||m.type==='master')continue;const st=this.voiceState(v,m);if(m.type==='note-input'){values.set(`${id}:pitch`,noteToHz(v.note));values.set(`${id}:gate`,v.released?0:1);values.set(`${id}:velocity`,v.velocity)}else if(m.type==='oscillator'){const p=this.input(values,id,'pitch')||this.param(m,'frequency',440),fm=this.input(values,id,'fm'),f=Math.max(.01,p*2**(fm/12))*2**(this.param(m,'detune',0)/1200),y=st.osc.next({waveform:this.param(m,'waveform','sine'),frequency:f,pulseWidth:this.param(m,'pulseWidth',.5)})*this.param(m,'level',.7);values.set(`${id}:audio`,sanitizeSample(y))}else if(m.type==='adsr'){const gate=this.input(values,id,'gate')>0;if(st.lastGate!==gate){st.env.gate(gate);st.lastGate=gate}const y=st.env.next({attack:this.param(m,'attack',.01),decay:this.param(m,'decay',.15),sustain:this.param(m,'sustain',.75),release:this.param(m,'release',.25)});values.set(`${id}:env`,y);if(v.released&&st.env.stage==='idle')st.done=true}else if(m.type==='mixer'){const y=this.input(values,id,'in1')*this.param(m,'gain1',1)+this.input(values,id,'in2')*this.param(m,'gain2',1);values.set(`${id}:audio`,sanitizeSample(y))}else if(m.type==='filter'){const x=this.input(values,id,'audio'),mod=this.input(values,id,'cutoffMod'),cutoff=Math.max(20,this.param(m,'cutoff',16000)*2**(mod*4));values.set(`${id}:audio`,st.filter.process(x,{cutoff,resonance:this.param(m,'resonance',.7)}))}else if(m.type==='vca'){const x=this.input(values,id,'audio'),cv=this.incoming.has(`${id}:cv`)?Math.max(0,this.input(values,id,'cv')):1;values.set(`${id}:audio`,applyVCA(x,this.param(m,'gain',.8),cv))}}
     for(const m of this.graph.modules.filter(x=>x.type==='master')){let y=this.input(values,m.id,'audio')*this.param(m,'gain',.8);frame+=sanitizeSample(y)}
     if(v.released){const envStates=[...v.state.values()].filter(s=>s.env);if(envStates.length===0){v.releaseAge=(v.releaseAge||0)+1;if(v.releaseAge>this.sampleRate*.25)retire.push(note)}else if(envStates.every(s=>s.done))retire.push(note)}
   }
   for(const n of retire)this.voices.delete(n);frame= Math.max(-.98,Math.min(.98,frame));left[i]=right[i]=frame;peak=Math.max(peak,Math.abs(frame));sum+=frame*frame;
  }return{peak,rms:Math.sqrt(sum/left.length),voices:this.voices.size}}
}
