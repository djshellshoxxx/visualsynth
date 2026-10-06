import { clamp } from './math.js';
import { sanitizeSample } from './safety.js';

export class StateVariableFilter {
  constructor({ sampleRate = 48000, cutoff = 1000, resonance = 0, mode = 'lowpass' } = {}) {
    if (!(sampleRate > 0)) throw new Error('sampleRate must be positive');
    this.sampleRate = sampleRate;
    this.mode = mode;
    this.ic1eq = 0;
    this.ic2eq = 0;
    this.setCutoff(cutoff);
    this.setResonance(resonance);
  }

  setCutoff(cutoff) {
    this.cutoff = clamp(Number.isFinite(cutoff) ? cutoff : 20, 5, this.sampleRate * 0.45);
  }

  setResonance(resonance) {
    this.resonance = clamp(Number.isFinite(resonance) ? resonance : 0, 0, 1);
  }

  reset() {
    this.ic1eq = 0;
    this.ic2eq = 0;
  }

  processSample(input) {
    const x = sanitizeSample(input);
    const g = Math.tan(Math.PI * this.cutoff / this.sampleRate);
    const q = 0.5 + this.resonance * 19.5;
    const k = 1 / q;
    const a1 = 1 / (1 + g * (g + k));
    const a2 = g * a1;
    const a3 = g * a2;

    const v3 = x - this.ic2eq;
    const v1 = a1 * this.ic1eq + a2 * v3;
    const v2 = this.ic2eq + a2 * this.ic1eq + a3 * v3;

    this.ic1eq = sanitizeSample(2 * v1 - this.ic1eq);
    this.ic2eq = sanitizeSample(2 * v2 - this.ic2eq);

    const low = v2;
    const band = v1;
    const high = x - k * band - low;
    const notch = high + low;

    switch (this.mode) {
      case 'highpass': return sanitizeSample(high);
      case 'bandpass': return sanitizeSample(band);
      case 'notch': return sanitizeSample(notch);
      case 'lowpass':
      default: return sanitizeSample(low);
    }
  }

  renderBlock(input) {
    const output = new Float32Array(input.length);
    for (let i = 0; i < input.length; i += 1) output[i] = this.processSample(input[i]);
    return output;
  }
}


export class FilterCascade {
  constructor({ sampleRate=48000, cutoff=1000, resonance=0, mode='lowpass', slope=12, drive=0, wet=1 }={}) {
    this.sampleRate=sampleRate;
    this.stages=Array.from({length:4},()=>new StateVariableFilter({sampleRate,cutoff,resonance,mode}));
    this.setCutoff(cutoff); this.setResonance(resonance); this.mode=mode; this.slope=slope; this.drive=drive; this.wet=wet;
  }
  setCutoff(value){ this.cutoff=clamp(Number.isFinite(value)?value:20,5,this.sampleRate*.45); for(const stage of this.stages) stage.setCutoff(this.cutoff); }
  setResonance(value){ this.resonance=clamp(Number.isFinite(value)?value:0,0,1); for(const stage of this.stages) stage.setResonance(this.resonance); }
  set mode(value){ this._mode=['lowpass','highpass','bandpass','notch'].includes(value)?value:'lowpass'; for(const stage of this.stages) stage.mode=this._mode; }
  get mode(){ return this._mode; }
  processSample(input){
    const dry=sanitizeSample(input);
    let processed=Math.tanh(dry*(1+Math.max(0,Number(this.drive)||0)));
    const count=Math.max(1,Math.min(4,Math.round((Number(this.slope)||12)/12)));
    for(let i=0;i<count;i++) processed=this.stages[i].processSample(processed);
    const wet=clamp(Number.isFinite(this.wet)?this.wet:1,0,1);
    return sanitizeSample(dry*(1-wet)+processed*wet);
  }
  reset(){ for(const stage of this.stages) stage.reset(); }
}
