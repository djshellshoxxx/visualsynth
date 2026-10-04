export const MESSAGE_TYPES=Object.freeze(['init','graphSwap','note','parameter','panic','telemetry']);
export const makeMessage=(type,payload={})=>{if(!MESSAGE_TYPES.includes(type))throw Error(`Unknown protocol message ${type}`);return{type,...payload}};
export const isNewerRevision=(next,current)=>Number.isFinite(next)&&next>current;
