export const SignalType=Object.freeze({AUDIO:'audio',CONTROL:'control',GATE:'gate',PITCH:'pitch',EVENT:'event'});
export const VoiceScope=Object.freeze({VOICE:'voice',GLOBAL:'global'});
export const port=(id,direction,signal,{multi=direction==='out'}={})=>({id,direction,signal,multi});
export const param=(id,name,min,max,def,{curve='linear',unit='',step=0,modulatable=true,automatable=true,midi=true,smoothingMs=8}={})=>({id,name,min,max,default:def,curve,unit,step,modulatable,automatable,midi,smoothingMs});
