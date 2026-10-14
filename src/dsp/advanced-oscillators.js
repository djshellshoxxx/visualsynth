import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

const TAU = Math.PI * 2;
function wrapPhase(value) { return value - Math.floor(value); }
function polyBlep(t, dt) {
  if (t < dt) { const x = t / dt; return x + x - x * x - 1; }
  if (t > 1 - dt) { const x = (t - 1) / dt; return x * x + x + x + 1; }
  return 0;
}
function sawSample(phase, dt) { return (phase * 2 - 1) - polyBlep(phase, dt); }

export class AdditiveOscillator {
  constructor({ sampleRate=48000, frequency=220, harmonics=[1,.5,.25], amplitude=1 }={}) {
    this.sampleRate=sampleRate; this.phase=0; this.frequency=frequency; this.harmonics=[...harmonics]; this.amplitude=amplitude;
  }
  setFrequency(value){ this.frequency=clamp(Number(value)||220,.01,this.sampleRate*.45); }
  nextSample(){
    const f=clamp(this.frequency,.01,this.sampleRate*.45), max=Math.floor((this.sampleRate*.5)/f);
    let sum=0,norm=0;
    for(let i=0;i<this.harmonics.length && i<max;i++){ const a=Number.isFinite(this.harmonics[i])?this.harmonics[i]:0; sum+=Math.sin(TAU*this.phase*(i+1))*a; norm+=Math.abs(a); }
    this.phase=wrapPhase(this.phase+f/this.sampleRate);
    return sanitizeSample((norm?sum/norm:0)*this.amplitude);
  }
}

export class WavetableOscillator {
  constructor({ sampleRate=48000, frequency=220, morph=0, amplitude=1 }={}){ this.sampleRate=sampleRate; this.phase=0; this.frequency=frequency; this.morph=morph; this.amplitude=amplitude; }
  setFrequency(value){ this.frequency=clamp(Number(value)||220,.01,this.sampleRate*.45); }
  nextSample(){
    const f=clamp(this.frequency,.01,this.sampleRate*.45), dt=f/this.sampleRate, p=this.phase;
    const sine=Math.sin(TAU*p), saw=sawSample(p,dt), triangle=2*Math.abs(2*(p-Math.floor(p+.5)))-1;
    const m=clamp(this.morph,0,1);
    const first=sine*(1-Math.min(1,m*2))+saw*Math.min(1,m*2);
    const second=saw*(1-Math.max(0,m*2-1))+triangle*Math.max(0,m*2-1);
    this.phase=wrapPhase(p+dt);
    return sanitizeSample((m<=.5?first:second)*this.amplitude);
  }
}

export class SupersawOscillator {
  constructor({ sampleRate=48000, frequency=220, voices=7, detune=.18, spread=.7, amplitude=1 }={}){
    this.sampleRate=sampleRate; this.frequency=frequency; this.voices=Math.round(clamp(voices,2,11)); this.detune=detune; this.spread=spread; this.amplitude=amplitude;
    this.phases=Array.from({length:11},(_,i)=>wrapPhase(i*.173));
  }
  setFrequency(value){ this.frequency=clamp(Number(value)||220,.01,this.sampleRate*.4); }
  nextSample(){
    let sum=0; const count=Math.round(clamp(this.voices,2,11));
    for(let i=0;i<count;i++){
      const centered=count===1?0:(i/(count-1))*2-1;
      const cents=centered*clamp(this.detune,0,1)*42;
      const f=clamp(this.frequency*2**(cents/1200),.01,this.sampleRate*.45), dt=f/this.sampleRate;
      sum+=sawSample(this.phases[i],dt); this.phases[i]=wrapPhase(this.phases[i]+dt);
    }
    return sanitizeSample((sum/Math.sqrt(count))*0.55*this.amplitude);
  }
}
