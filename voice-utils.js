(function(root){
 function wavBlob(samples,sampleRate){
  const targetRate=16000,length=Math.floor(samples.length*targetRate/sampleRate);const buffer=new ArrayBuffer(44+length*2),view=new DataView(buffer);
  const str=(offset,text)=>{for(let i=0;i<text.length;i++)view.setUint8(offset+i,text.charCodeAt(i));};
  str(0,'RIFF');view.setUint32(4,36+length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,targetRate,true);view.setUint32(28,targetRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,length*2,true);
  for(let i=0;i<length;i++){
   const at=i*sampleRate/targetRate,lo=Math.floor(at),mix=at-lo;const value=(samples[lo]||0)*(1-mix)+(samples[Math.min(lo+1,samples.length-1)]||0)*mix;
   const clipped=Math.max(-1,Math.min(1,value));view.setInt16(44+i*2,clipped<0?clipped*32768:clipped*32767,true);
  }
  return new Blob([buffer],{type:'audio/wav'});
 }
 function concat(chunks){const length=chunks.reduce((n,c)=>n+c.length,0),samples=new Float32Array(length);let offset=0;for(const chunk of chunks){samples.set(chunk,offset);offset+=chunk.length;}return samples;}
 function rms(samples){return Math.sqrt(samples.reduce((sum,v)=>sum+v*v,0)/Math.max(1,samples.length));}
 class TurnDetector{
  constructor(){this.reset();}
  reset(){this.chunks=[];this.pre=[];this.started=false;this.voiced=0;this.silence=0;this.length=0;}
  push(chunk,rate){
   const ms=chunk.length/rate*1000,voiced=rms(chunk)>.012;
   if(!this.started){this.pre.push(chunk);if(this.pre.length>8)this.pre.shift();if(voiced)this.voiced+=ms;else this.voiced=Math.max(0,this.voiced-ms);if(this.voiced>=110){this.started=true;this.chunks=[...this.pre];this.length=this.chunks.reduce((n,c)=>n+c.length,0)/rate*1000;}return null;}
   this.chunks.push(chunk);this.length+=ms;this.silence=voiced?0:this.silence+ms;
   if(voiced)this.voiced+=ms;
   if(this.length>=29000||(this.silence>=1350&&this.voiced>=200))return this.finish();
   return null;
  }
  finish(){const chunks=this.started&&this.voiced>=200?this.chunks:null;this.reset();return chunks;}
 }
 root.DaylightVoiceUtils={wavBlob,concat,rms,TurnDetector};
})(globalThis);
