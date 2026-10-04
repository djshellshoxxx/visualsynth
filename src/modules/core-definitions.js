import {SignalType as S,VoiceScope as V,port,param,choiceParam} from '../graph/types.js';
const p={in:(id,s,o)=>port(id,'in',s,o),out:(id,s,o)=>port(id,'out',s,o)};
export const coreDefinitions=[
 {typeId:'note-input',name:'Note Input',scope:V.VOICE,category:'Input',ports:[p.out('pitch',S.PITCH),p.out('gate',S.GATE),p.out('velocity',S.CONTROL)],parameters:[]},
 {typeId:'oscillator',name:'Oscillator',scope:V.VOICE,category:'Source',ports:[p.in('pitch',S.PITCH),p.in('fm',S.CONTROL),p.out('audio',S.AUDIO)],parameters:[choiceParam('waveform','Waveform',['sine','triangle','saw','reverse-saw','square','pulse','white-noise'],'saw'),param('frequency','Frequency',20,20000,440,{curve:'log',unit:'Hz'}),param('detune','Detune',-1200,1200,0,{unit:'cent'}),param('level','Level',0,1,.7),param('pulseWidth','Pulse Width',.05,.95,.5)]},
 {typeId:'mixer',name:'Mixer',scope:V.VOICE,category:'Utility',ports:[p.in('in1',S.AUDIO,{multi:true}),p.in('in2',S.AUDIO,{multi:true}),p.out('audio',S.AUDIO)],parameters:[param('gain1','Gain 1',0,2,1),param('gain2','Gain 2',0,2,1)]},
 {typeId:'filter',name:'Filter',scope:V.VOICE,category:'Processor',ports:[p.in('audio',S.AUDIO),p.in('cutoffMod',S.CONTROL),p.out('audio',S.AUDIO)],parameters:[param('cutoff','Cutoff',20,20000,16000,{curve:'log',unit:'Hz'}),param('resonance','Resonance',.1,20,.7)]},
 {typeId:'adsr',name:'ADSR',scope:V.VOICE,category:'Modulator',ports:[p.in('gate',S.GATE),p.out('env',S.CONTROL)],parameters:[param('attack','Attack',.001,10,.01,{curve:'log',unit:'s'}),param('decay','Decay',.001,10,.15,{curve:'log',unit:'s'}),param('sustain','Sustain',0,1,.75),param('release','Release',.001,20,.25,{curve:'log',unit:'s'})]},
 {typeId:'lfo',name:'LFO',scope:V.GLOBAL,category:'Modulator',ports:[p.out('control',S.CONTROL)],parameters:[choiceParam('waveform','Waveform',['sine','triangle','square','saw','reverse-saw','sample-hold'],'sine'),param('rate','Rate',.01,40,2,{curve:'log',unit:'Hz'}),param('depth','Depth',0,1,.5)]},
 {typeId:'vca',name:'VCA',scope:V.VOICE,category:'Processor',ports:[p.in('audio',S.AUDIO),p.in('cv',S.CONTROL),p.out('audio',S.AUDIO)],parameters:[param('gain','Gain',0,2,.8)]},
 {typeId:'master',name:'Master Output',scope:V.GLOBAL,category:'Output',ports:[p.in('audio',S.AUDIO,{multi:true})],parameters:[param('gain','Master',0,1,.8)]}
];
