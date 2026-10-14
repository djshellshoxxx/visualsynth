import { sanitizeSample } from './safety.js';
export class FeedbackDelay {
  constructor({ samples=1, feedback=.35 }={}){ this.setSamples(samples);this.setFeedback(feedback);this.buffer=new Float32Array(this.samples);this.index=0;this.output=0; }
  setSamples(value){ this.samples=Math.max(1,Math.min(4096,Math.round(Number(value)||1))); if(this.buffer&&this.buffer.length!==this.samples){this.buffer=new Float32Array(this.samples);this.index=0;this.output=0;} }
  setFeedback(value){ this.feedback=Math.max(-.98,Math.min(.98,Number.isFinite(value)?value:.35)); }
  read(){ return sanitizeSample(this.output); }
  write(input){ const delayed=this.buffer[this.index]??0; this.buffer[this.index]=sanitizeSample(input+delayed*this.feedback); this.index=(this.index+1)%this.buffer.length; this.output=delayed; return this.output; }
  processSample(input){ const out=this.read();this.write(input);return out; }
}
