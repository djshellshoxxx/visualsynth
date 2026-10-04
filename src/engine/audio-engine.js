import {makeMessage} from './protocol.js';
export class AudioEngine{
 constructor(onTelemetry=()=>{}){this.onTelemetry=onTelemetry;this.context=null;this.node=null;this.started=false;this.graphRevision=0;this.outputMuted=false}
 async start(){if(this.started)return;const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('Web Audio API unavailable');this.context=this.context||new C({latencyHint:'interactive'});await this.context.resume();if(!this.context.audioWorklet)throw Error('AudioWorklet unavailable');await this.context.audioWorklet.addModule(new URL('./worklet-processor.js',import.meta.url));this.node=new AudioWorkletNode(this.context,'visualsynth-engine',{numberOfInputs:0,numberOfOutputs:1,outputChannelCount:[2]});this.gain=this.context.createGain();this.gain.gain.value=this.outputMuted?0:1;this.analyser=this.context.createAnalyser();this.analyser.fftSize=2048;this.node.connect(this.gain);this.gain.connect(this.analyser);this.analyser.connect(this.context.destination);this.node.port.onmessage=e=>{if(e.data?.type==='telemetry')this.onTelemetry(e.data)};this.node.onprocessorerror=()=>this.panic();this.started=true}
 async applyCompiledGraph(graph){await this.start();this.graphRevision++;this.node.port.postMessage(makeMessage('graphSwap',{graph,revision:this.graphRevision}));return this.graphRevision}
 sendNote(event){this.node?.port.postMessage(makeMessage('note',{event}))}
 setParameter(moduleId,paramId,value){this.node?.port.postMessage(makeMessage('parameter',{moduleId,paramId,value}))}
 setMuted(muted){this.outputMuted=Boolean(muted);if(this.gain)this.gain.gain.setValueAtTime(this.outputMuted?0:1,this.context.currentTime)}
 panic(){if(this.gain&&this.context){const t=this.context.currentTime;this.gain.gain.cancelScheduledValues(t);this.gain.gain.setValueAtTime(0,t);this.gain.gain.linearRampToValueAtTime(1,t+.02)}this.node?.port.postMessage(makeMessage('panic'))}
 diagnostics(){return{started:this.started,state:this.context?.state??'not-created',sampleRate:this.context?.sampleRate??null,baseLatency:this.context?.baseLatency??null,graphRevision:this.graphRevision,outputMuted:this.outputMuted}}
}
