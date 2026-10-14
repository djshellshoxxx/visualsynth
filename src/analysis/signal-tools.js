export function traceSignalPath(patch,sourceId,targetId){
  if(sourceId===targetId)return[sourceId]; const queue=[[sourceId]], seen=new Set([sourceId]);
  while(queue.length){ const path=queue.shift(), last=path.at(-1); for(const c of patch?.connections??[]){ if(c.from?.moduleId!==last)continue; const next=c.to?.moduleId; if(!next||seen.has(next))continue; const candidate=[...path,next]; if(next===targetId)return candidate; seen.add(next);queue.push(candidate); } }
  return [];
}
export function compareSnapshots(a={},b={}){ const keys=new Set([...Object.keys(a),...Object.keys(b)]); return [...keys].filter(key=>a[key]!==b[key]).sort().map(parameterId=>({parameterId,a:a[parameterId],b:b[parameterId]})); }
export class ProbeBuffer {
  constructor({capacity=1024}={}){ this.capacity=Math.max(8,capacity);this.values=[]; }
  push(value){ if(!Number.isFinite(value))return;this.values.push(value);if(this.values.length>this.capacity)this.values.splice(0,this.values.length-this.capacity); }
  snapshot(){ const values=[...this.values]; const peak=values.reduce((m,v)=>Math.max(m,Math.abs(v)),0), rms=Math.sqrt(values.reduce((s,v)=>s+v*v,0)/Math.max(1,values.length)), dc=values.reduce((s,v)=>s+v,0)/Math.max(1,values.length); return {values,peak,rms,dc}; }
}
