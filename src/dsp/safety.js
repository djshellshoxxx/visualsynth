export const clamp=(v,min,max)=>Math.min(max,Math.max(min,v));
export function sanitizeSample(v){return Number.isFinite(v)&&Math.abs(v)>1e-24?clamp(v,-8,8):0}
export function safeGain(v,limit=4){return clamp(Number.isFinite(v)?v:0,-Math.abs(limit),Math.abs(limit))}
