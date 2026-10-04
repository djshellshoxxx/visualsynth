import {sanitizeSample} from './safety.js';export function mix(inputs,gains=[]){let y=0;for(let i=0;i<inputs.length;i++)y+=sanitizeSample(inputs[i])*(gains[i]??1);return sanitizeSample(y)}
