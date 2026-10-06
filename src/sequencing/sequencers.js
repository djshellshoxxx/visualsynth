export class TransportClock {
  constructor({sampleRate=48000,bpm=120,swing=0}={}){ this.sampleRate=sampleRate;this.bpm=bpm;this.swing=swing; }
  get framesPerBeat(){ return this.sampleRate*60/Math.max(1,this.bpm); }
  positionAt(frame){ const beats=frame/this.framesPerBeat; return { beat:Math.floor(beats), phase:beats-Math.floor(beats), bar:Math.floor(beats/4) }; }
}
export class StepSequencer {
  constructor({steps=[60],framesPerStep=12000}={}){ this.steps=[...steps];this.framesPerStep=Math.max(1,framesPerStep); }
  stepAt(frame){ const index=Math.floor(Math.max(0,frame)/this.framesPerStep)%Math.max(1,this.steps.length); return { index, value:this.steps[index] ?? 0 }; }
}
export function euclideanPattern(pulses,steps,rotation=0){
  const n=Math.max(1,Math.trunc(steps)), k=Math.max(0,Math.min(n,Math.trunc(pulses))), r=((Math.trunc(rotation)%n)+n)%n;
  const base=Array.from({length:n},(_,i)=>(i*k)%n<k?1:0);
  return base.map((_,i)=>base[(i-r+n)%n]);
}
export function deterministicProbability(seed,index,probability=1){ let x=(Math.trunc(seed)^(index*0x9e3779b9))>>>0; x^=x<<13;x^=x>>>17;x^=x<<5; return ((x>>>0)/4294967296)<Math.max(0,Math.min(1,probability)); }
