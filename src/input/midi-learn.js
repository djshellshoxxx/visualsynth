function shape(value, curve){ const v=Math.max(0,Math.min(1,value)); if(curve==='exp') return v*v; if(curve==='log') return Math.sqrt(v); return v; }
export class MidiLearnMap {
  constructor(bindings=[]){ this.bindings=[]; for(const binding of bindings) this.bind(binding); }
  bind(binding){ if(!Number.isInteger(binding?.controller)) throw new Error('MIDI CC controller is required'); if(!binding.moduleId||!binding.parameterId) throw new Error('MIDI Learn target is required'); this.unbind(binding.moduleId,binding.parameterId); this.bindings.push({min:0,max:1,invert:false,curve:'linear',...binding}); return this; }
  unbind(moduleId,parameterId){ this.bindings=this.bindings.filter(item=>item.moduleId!==moduleId||item.parameterId!==parameterId); }
  apply(event){ if(event?.type!=='cc') return null; const binding=this.bindings.find(item=>item.controller===event.controller && (item.channel==null||item.channel===event.channel)); if(!binding) return null; let v=Math.max(0,Math.min(1,event.value)); if(binding.invert)v=1-v; v=shape(v,binding.curve); return {moduleId:binding.moduleId,parameterId:binding.parameterId,value:binding.min+(binding.max-binding.min)*v}; }
  toJSON(){ return this.bindings.map(binding=>({...binding})); }
}
