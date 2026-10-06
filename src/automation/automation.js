export class AutomationLane {
  constructor(points=[]){ this.points=[]; this.setPoints(points); }
  setPoints(points){ this.points=[...points].filter(p=>Number.isInteger(p.frame)&&Number.isFinite(p.value)).sort((a,b)=>a.frame-b.frame); }
  valueAt(frame){
    if(!this.points.length) return null;
    if(frame<=this.points[0].frame) return this.points[0].value;
    const last=this.points.at(-1); if(frame>=last.frame) return last.value;
    for(let i=1;i<this.points.length;i++){ const b=this.points[i],a=this.points[i-1]; if(frame<=b.frame){ if(b.curve==='step') return a.value; const t=(frame-a.frame)/(b.frame-a.frame); return a.value+(b.value-a.value)*t; } }
    return last.value;
  }
  record(frame,value){ if(!Number.isInteger(frame)||!Number.isFinite(value)) return false; this.points.push({frame,value}); this.points.sort((a,b)=>a.frame-b.frame); return true; }
}
