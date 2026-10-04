import {sanitizeSample,safeGain} from './safety.js';export const applyVCA=(sample,gain=1,cv=1)=>sanitizeSample(sample*safeGain(gain)*Math.max(0,cv));
