import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

function normalize(points){
  const valid=(points??[]).filter(p=>Number.isFinite(p.time)&&Number.isFinite(p.value)).map(p=>({time:Math.max(0,p.time),value:clamp(p.value,-1,1),curve:p.curve??'linear'})).sort((a,b)=>a.time-b.time);
  if(!valid.length||valid[0].time>0) valid.unshift({time:0,value:valid[0]?.value??0,curve:'linear'});
  return valid.length>1?valid:[valid[0],{time:.1,value:valid[0].value,curve:'linear'}];
}
function interpolate(a,b,t){ if(b.curve==='step')return a.value; if(b.curve==='exp'){const x=t*t;return a.value+(b.value-a.value)*x;} return a.value+(b.value-a.value)*t; }

export class MultiStageEnvelope {
  constructor({sampleRate=48000,points=[{time:0,value:0},{time:.01,value:1},{time:.2,value:.7}],loop=false,loopStart=0,loopEnd=null}={}){
    this.sampleRate=sampleRate;this.points=normalize(points);this.loop=Boolean(loop);this.loopStart=Math.max(0,loopStart);this.loopEnd=loopEnd;this.gate=false;this.frame=0;this.value=this.points[0].value;
  }
  setPoints(points){this.points=normalize(points);}
  gateOn(){this.gate=true;this.frame=0;this.value=this.points[0].value;}
  gateOff(){this.gate=false;}
  nextSample(){
    const endTime=this.points.at(-1).time, time=this.frame/this.sampleRate;
    let local=time;
    if(this.loop&&this.gate&&endTime>0){
      const start=this.points[Math.min(this.points.length-2,this.loopStart)]?.time??0;
      const endIndex=this.loopEnd==null?this.points.length-1:Math.max(this.loopStart+1,Math.min(this.points.length-1,this.loopEnd));
      const end=this.points[endIndex]?.time??endTime, span=Math.max(1/this.sampleRate,end-start);
      if(local>=end)local=start+((local-start)%span);
    } else if(local>=endTime){ this.value=this.points.at(-1).value; this.frame+=1; return sanitizeSample(this.value); }
    let a=this.points[0],b=this.points.at(-1);
    for(let i=1;i<this.points.length;i++){ if(local<=this.points[i].time){a=this.points[i-1];b=this.points[i];break;} }
    const span=Math.max(1e-9,b.time-a.time),t=clamp((local-a.time)/span,0,1);this.value=interpolate(a,b,t);this.frame+=1;return sanitizeSample(this.value);
  }
  renderBlock(length){const out=new Float32Array(Math.max(0,Math.floor(length)));for(let i=0;i<out.length;i++)out[i]=this.nextSample();return out;}
}
