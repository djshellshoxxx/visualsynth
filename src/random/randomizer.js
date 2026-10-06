function mulberry32(seed){ let a=seed>>>0; return ()=>{ a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return ((t^t>>>14)>>>0)/4294967296; }; }
export class PatchRandomizer {
  constructor({seed=1}={}){ this.random=mulberry32(seed); }
  parameters(values,metadata,{locks=[],mode='safe'}={}){
    const result={...values}, locked=new Set(locks);
    for(const [id,meta] of Object.entries(metadata??{})){ if(locked.has(id)) continue; const min=mode==='safe'?(meta.safeMin??meta.min):meta.min,max=mode==='safe'?(meta.safeMax??meta.max):meta.max; if(Number.isFinite(min)&&Number.isFinite(max)) result[id]=min+(max-min)*this.random(); }
    return result;
  }
}
