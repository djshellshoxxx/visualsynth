export const TAU=Math.PI*2;export const noteToHz=(n,a4=440)=>a4*2**((n-69)/12);
export function polyBlep(t,dt){if(t<dt){t/=dt;return t+t-t*t-1}if(t>1-dt){t=(t-1)/dt;return t*t+t+t+1}return 0}
