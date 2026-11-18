class DaylightPcmRecorder extends AudioWorkletProcessor{
 constructor(){super();this.samples=new Float32Array(2048);this.offset=0;}
 process(inputs,outputs){
  for(const output of outputs)for(const channel of output)channel.fill(0);
  const channel=inputs[0]?.[0];if(!channel)return true;
  for(let i=0;i<channel.length;i++){
   this.samples[this.offset++]=channel[i];
   if(this.offset===this.samples.length){this.port.postMessage(this.samples.buffer,[this.samples.buffer]);this.samples=new Float32Array(2048);this.offset=0;}
  }
  return true;
 }
}
registerProcessor('daylight-pcm-recorder',DaylightPcmRecorder);

// Continuous resampling retains phase across render blocks; emit exactly 20 ms of 16 kHz PCM.
class SpeakiRealtimeRecorder extends AudioWorkletProcessor{
 constructor(){super();this.pending=[];this.phase=0;this.frame=new ArrayBuffer(640);this.view=new DataView(this.frame);this.offset=0;}
 process(inputs,outputs){
  for(const output of outputs)for(const channel of output)channel.fill(0);
  const channel=inputs[0]?.[0];if(!channel)return true;for(const v of channel)this.pending.push(v);
  const step=sampleRate/16000;
  while(this.phase+1<this.pending.length){const low=Math.floor(this.phase),mix=this.phase-low,value=Math.max(-1,Math.min(1,this.pending[low]*(1-mix)+this.pending[low+1]*mix));this.view.setInt16(this.offset*2,value<0?value*32768:value*32767,true);this.offset++;this.phase+=step;if(this.offset===320){this.port.postMessage(this.frame,[this.frame]);this.frame=new ArrayBuffer(640);this.view=new DataView(this.frame);this.offset=0;}}
  const used=Math.min(Math.floor(this.phase),Math.max(0,this.pending.length-1));this.pending=this.pending.slice(used);this.phase-=used;return true;
 }
}
registerProcessor('speaki-realtime-recorder',SpeakiRealtimeRecorder);
