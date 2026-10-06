function writeString(view,offset,text){ for(let i=0;i<text.length;i++) view.setUint8(offset+i,text.charCodeAt(i)); }
export function encodeWav(samples,{sampleRate=48000,channels=1,format='pcm16'}={}){
  const bits=format==='pcm24'?24:format==='float32'?32:16, audioFormat=format==='float32'?3:1, bytes=bits/8;
  const frames=Math.floor(samples.length/channels), dataSize=frames*channels*bytes, buffer=new ArrayBuffer(44+dataSize), view=new DataView(buffer);
  writeString(view,0,'RIFF');view.setUint32(4,36+dataSize,true);writeString(view,8,'WAVE');writeString(view,12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,audioFormat,true);view.setUint16(22,channels,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*channels*bytes,true);view.setUint16(32,channels*bytes,true);view.setUint16(34,bits,true);writeString(view,36,'data');view.setUint32(40,dataSize,true);
  let o=44; for(const raw of samples){ const s=Math.max(-1,Math.min(1,Number.isFinite(raw)?raw:0)); if(format==='float32'){view.setFloat32(o,s,true);o+=4;} else if(format==='pcm24'){ let v=Math.round(s*(s<0?8388608:8388607)); if(v<0)v+=16777216;view.setUint8(o,v&255);view.setUint8(o+1,(v>>8)&255);view.setUint8(o+2,(v>>16)&255);o+=3;} else {view.setInt16(o,Math.round(s*(s<0?32768:32767)),true);o+=2;} }
  return buffer;
}
