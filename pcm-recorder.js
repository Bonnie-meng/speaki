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
