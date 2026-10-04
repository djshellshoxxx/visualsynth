const baseSettings={polyphony:8,mode:'poly',masterGain:.8};
const patch=(modules,connections)=>({schemaVersion:1,settings:{...baseSettings},ui:{zoom:1,pan:{x:0,y:0}},modules,connections});
const note=(x=30,y=120)=>({id:'note',type:'note-input',position:{x,y},params:{}});
const osc=(id,x,y,waveform='saw',detune=0,level=.6)=>({id,type:'oscillator',position:{x,y},params:{waveform,frequency:440,detune,level,pulseWidth:.5}});
const env=(id='env',x=270,y=330,a=.01,d=.15,s=.75,r=.25)=>({id,type:'adsr',position:{x,y},params:{attack:a,decay:d,sustain:s,release:r}});
const filter=(x=700,y=90,cutoff=8000,resonance=.8)=>({id:'filter',type:'filter',position:{x,y},params:{cutoff,resonance}});
const vca=(x=930,y=100,gain=.8)=>({id:'vca',type:'vca',position:{x,y},params:{gain}});
const master=(x=1160,y=110)=>({id:'master',type:'master',position:{x,y},params:{gain:.8}});
const c=(id,fm,fp,tm,tp,extra={})=>({id,from:{module:fm,port:fp},to:{module:tm,port:tp},...extra});
function single({waveform='saw',detune=0,cutoff=8000,resonance=.8,attack=.01,decay=.15,sustain=.75,release=.25,level=.7}={}){return patch([note(),osc('osc',270,80,waveform,detune,level),env('env',270,330,attack,decay,sustain,release),filter(520,80,cutoff,resonance),vca(760,100),master(1000,110)],[c('c1','note','pitch','osc','pitch'),c('c2','note','gate','env','gate'),c('c3','osc','audio','filter','audio'),c('c4','filter','audio','vca','audio'),c('c5','env','env','vca','cv'),c('c6','vca','audio','master','audio')])}
function dual({waves=['saw','saw'],detunes=[-7,7],cutoff=9000,resonance=.7,attack=.01,decay=.18,sustain=.7,release=.3}={}){return patch([note(),osc('osc1',250,40,waves[0],detunes[0],.42),osc('osc2',250,210,waves[1],detunes[1],.42),{id:'mix',type:'mixer',position:{x:500,y:100},params:{gain1:1,gain2:1}},env('env',500,340,attack,decay,sustain,release),filter(730,100,cutoff,resonance),vca(960,110),master(1190,110)],[c('p1','note','pitch','osc1','pitch'),c('p2','note','pitch','osc2','pitch'),c('g','note','gate','env','gate'),c('a1','osc1','audio','mix','in1'),c('a2','osc2','audio','mix','in2'),c('mf','mix','audio','filter','audio'),c('fv','filter','audio','vca','audio'),c('ev','env','env','vca','cv'),c('vm','vca','audio','master','audio')])}
const educational=single({waveform:'square',cutoff:3500,resonance:1.2,attack:.05,release:.5});
export const factoryPresets=[
 {id:'basic-subtractive',name:'Basic Subtractive',description:'Classic oscillator → filter → envelope-controlled VCA.',patch:single()},
 {id:'two-osc-analog',name:'Two Oscillator Analog',description:'Two detuned analog-style oscillators mixed before the filter.',patch:dual()},
 {id:'supersaw-lite',name:'Supersaw Lite',description:'Wide detuned saw pair with a bright filter.',patch:dual({detunes:[-15,15],cutoff:14000,attack:.02,release:.7})},
 {id:'bass',name:'Bass',description:'Short, resonant low-register subtractive voice.',patch:single({waveform:'saw',cutoff:900,resonance:3,attack:.002,decay:.12,sustain:.45,release:.12})},
 {id:'lead',name:'Lead',description:'Focused pulse lead with moderate resonance.',patch:single({waveform:'pulse',cutoff:4200,resonance:2.2,attack:.006,decay:.1,sustain:.82,release:.2})},
 {id:'pad',name:'Pad',description:'Slow dual-oscillator pad with long release.',patch:dual({waves:['triangle','saw'],detunes:[-9,9],cutoff:5000,attack:.7,decay:1.2,sustain:.72,release:2.5})},
 {id:'noise-percussion',name:'Noise Percussion',description:'White-noise burst shaped by a short envelope.',patch:single({waveform:'white-noise',cutoff:7000,resonance:.6,attack:.001,decay:.08,sustain:0,release:.05,level:.55})},
 {id:'educational-basic',name:'Educational Basic Signal Flow',description:'Clear square-wave patch for seeing and hearing each stage.',patch:educational}
];
export function getFactoryPreset(id){const p=factoryPresets.find(x=>x.id===id);if(!p)throw Error(`Unknown factory preset ${id}`);return structuredClone(p)}
