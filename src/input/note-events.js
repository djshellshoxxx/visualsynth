export const noteOn=(note,velocity=1,channel=0)=>({type:'noteOn',note,velocity,channel});export const noteOff=(note,velocity=0,channel=0)=>({type:'noteOff',note,velocity,channel});
