import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

const TAU=Math.PI*2;
function equalPower(dry,wet,mix){ const m=clamp(mix,0,1); return sanitizeSample(dry*Math.cos(m*Math.PI*.5)+wet*Math.sin(m*Math.PI*.5)); }

class FractionalDelay {
  constructor(size){ this.buffer=new Float32Array(size); this.index=0; }
  read(delay){ const length=this.buffer.length; let p=this.index-delay; while(p<0)p+=length; const a=Math.floor(p)%length,b=(a+1)%length,t=p-Math.floor(p); return this.buffer[a]*(1-t)+this.buffer[b]*t; }
  write(value){ this.buffer[this.index]=sanitizeSample(value); this.index=(this.index+1)%this.buffer.length; }
}

export class ChorusEffect {
  constructor({sampleRate=48000,rate=.35,depth=.45,feedback=.12,mix=.35}={}){ this.sampleRate=sampleRate;this.rate=rate;this.depth=depth;this.feedback=feedback;this.mix=mix;this.phase=0;this.delay=new FractionalDelay(Math.ceil(sampleRate*.08));this.delayR=null;this.stereoOut={left:0,right:0}; }
  // Stereo chorus: right channel uses its own line with the LFO half a cycle out of phase; left matches processSample.
  processStereo(inL,inR){ const out=this.stereoOut; const dryL=sanitizeSample(inL), dryR=sanitizeSample(inR); this.delayR??=new FractionalDelay(this.delay.buffer.length); const base=.012*this.sampleRate, span=.009*this.sampleRate*clamp(this.depth,0,1), fb=clamp(this.feedback,-.85,.85); const dL=base+span*(.5+.5*Math.sin(TAU*this.phase)), dR=base+span*(.5+.5*Math.sin(TAU*(this.phase+.5))); const wetL=this.delay.read(dL), wetR=this.delayR.read(dR); this.delay.write(dryL+wetL*fb); this.delayR.write(dryR+wetR*fb); this.phase=(this.phase+clamp(this.rate,.02,8)/this.sampleRate)%1; out.left=equalPower(dryL,wetL,this.mix); out.right=equalPower(dryR,wetR,this.mix); return out; }
  processSample(input){ const dry=sanitizeSample(input), base=.012*this.sampleRate, span=.009*this.sampleRate*clamp(this.depth,0,1), d=base+span*(.5+.5*Math.sin(TAU*this.phase)); const wet=this.delay.read(d); this.delay.write(dry+wet*clamp(this.feedback,-.85,.85)); this.phase=(this.phase+clamp(this.rate,.02,8)/this.sampleRate)%1; return equalPower(dry,wet,this.mix); }
}
export class PhaserEffect {
  constructor({sampleRate=48000,rate=.25,depth=.6,feedback=.18,mix=.4}={}){ this.sampleRate=sampleRate;this.rate=rate;this.depth=depth;this.feedback=feedback;this.mix=mix;this.phase=0;this.z=[0,0,0,0];this.fb=0; }
  processSample(input){ const dry=sanitizeSample(input), sweep=.5+.5*Math.sin(TAU*this.phase), f=180+2200*sweep*clamp(this.depth,0,1), a=(1-Math.tan(Math.PI*f/this.sampleRate))/(1+Math.tan(Math.PI*f/this.sampleRate)); let x=sanitizeSample(dry+this.fb*clamp(this.feedback,-.85,.85)); for(let i=0;i<4;i++){ const y=-a*x+this.z[i]; this.z[i]=x+a*y; x=y; } this.fb=x; this.phase=(this.phase+clamp(this.rate,.02,8)/this.sampleRate)%1; return equalPower(dry,x,this.mix); }
}
export class ReverbEffect {
  constructor({sampleRate=48000,size=.55,decay=2.8,damping=.45,preDelay=.015,mix=.3}={}){ this.sampleRate=sampleRate;this.size=size;this.decay=decay;this.damping=damping;this.mix=mix; const scale=sampleRate/48000; this.lines=[1499,1613,1867,1999].map(n=>new FractionalDelay(Math.ceil(n*scale*2))); this.low=[0,0,0,0]; this.pre=new FractionalDelay(Math.ceil(sampleRate*.25)); this.preDelay=preDelay; }
  processSample(input){ const dry=sanitizeSample(input); const pd=this.pre.read(clamp(this.preDelay,0,.2)*this.sampleRate); this.pre.write(dry); let wet=0; const feedback=clamp(.55+Math.log1p(clamp(this.decay,.1,12))*.12,.5,.92); for(let i=0;i<this.lines.length;i++){ const delay=(.018+i*.006)*(0.7+clamp(this.size,0,1)*.8)*this.sampleRate; const v=this.lines[i].read(delay); this.low[i]+=(v-this.low[i])*(1-clamp(this.damping,0,1)*.96); this.lines[i].write(pd+this.low[i]*feedback*(i%2?-.82:.82)); wet+=v; } return equalPower(dry,wet/this.lines.length,this.mix); }
}
export class ParametricEqEffect {
  constructor({sampleRate=48000,frequency=1000,gain=0,q=1}={}){ this.sampleRate=sampleRate;this.frequency=frequency;this.gain=gain;this.q=q;this.x1=0;this.x2=0;this.y1=0;this.y2=0; }
  processSample(input){ const dry=sanitizeSample(input), A=10**(clamp(this.gain,-18,18)/40), w=TAU*clamp(this.frequency,20,this.sampleRate*.45)/this.sampleRate, alpha=Math.sin(w)/(2*clamp(this.q,.1,18)); const b0=1+alpha*A,b1=-2*Math.cos(w),b2=1-alpha*A,a0=1+alpha/A,a1=-2*Math.cos(w),a2=1-alpha/A; const y=(b0/a0)*dry+(b1/a0)*this.x1+(b2/a0)*this.x2-(a1/a0)*this.y1-(a2/a0)*this.y2; this.x2=this.x1;this.x1=dry;this.y2=this.y1;this.y1=sanitizeSample(y); return this.y1; }
}
export class CompressorEffect {
  constructor({sampleRate=48000,threshold=-18,ratio=4,attack=.01,release=.15,makeup=0}={}){ this.sampleRate=sampleRate;this.threshold=threshold;this.ratio=ratio;this.attack=attack;this.release=release;this.makeup=makeup;this.gain=1; }
  processSample(input){ const dry=sanitizeSample(input), db=20*Math.log10(Math.max(1e-9,Math.abs(dry))), over=Math.max(0,db-clamp(this.threshold,-60,0)), reduction=over*(1-1/clamp(this.ratio,1,20)), target=10**((-reduction+clamp(this.makeup,0,18))/20), coeff=Math.exp(-1/(this.sampleRate*(target<this.gain?clamp(this.attack,.001,.2):clamp(this.release,.01,2)))); this.gain=target+(this.gain-target)*coeff; return sanitizeSample(dry*this.gain); }
}
