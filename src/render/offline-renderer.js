import { WorkletRuntime } from '../engine/worklet-processor.js';
import { encodeWav } from './wav.js';
export class OfflineRenderer {
  async render(graph,{durationSeconds=1,sampleRate=48000,format='pcm16',onProgress=()=>{},signal}={}){
    const frames=Math.max(0,Math.round(durationSeconds*sampleRate)), runtime=new WorkletRuntime({sampleRate}); runtime.applyGraph({...graph,revision:1},1);
    const samples=new Float32Array(frames); let offset=0,peak=0;
    while(offset<frames){ if(signal?.aborted) throw new DOMException('Render cancelled','AbortError'); const count=Math.min(512,frames-offset),block=runtime.processBlock(count); samples.set(block.left,offset); for(const s of block.left)peak=Math.max(peak,Math.abs(s)); offset+=count; onProgress(frames?offset/frames:1); await Promise.resolve(); }
    return {frames,sampleRate,format,peak,wav:encodeWav(samples,{sampleRate,channels:1,format})};
  }
}
