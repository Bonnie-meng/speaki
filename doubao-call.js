(function(root){
 const playbackNotice='This reply could not play. Read the transcript or keep talking.';
 class DoubaoCall{
  constructor(call){this.call=call;this.sources=new Set();this.generation=0;this.nextAt=0;this.closed=false;this.ready=false;this.inputIndex=null;this.outputIndex=null;this.feedbackSequence=0;}
  async start(stream,context){
   this.context=context;this.stream=stream;
   const url=new URL('/api/voice/realtime',location.href);url.protocol=location.protocol==='https:'?'wss:':'ws:';url.searchParams.set('scenario',this.call.scenario);
   const socket=this.socket=new WebSocket(url);this.startTimer=setTimeout(()=>this.fail('The voice connection took too long. Please call again.'),18000);
   socket.onmessage=e=>{if(this.closed)return;let event;try{event=JSON.parse(e.data);}catch{return;}if(event&&typeof event.type==='string')this.event(event);};
   socket.onerror=()=>this.fail('Could not connect to Doubao. Please check the service connection and call again.');
   socket.onclose=()=>{if(!this.closed)this.fail('The voice connection ended. Please call again.');};
   this.source=context.createMediaStreamSource(stream);this.recorder=new AudioWorkletNode(context,'speaki-realtime-recorder');
   this.recorder.port.onmessage=e=>{if(this.closed||!this.ready||this.call.muted)return;const bytes=new Uint8Array(e.data);let str='';for(const b of bytes)str+=String.fromCharCode(b);this.send({type:'audio',audio:btoa(str)});};
   this.source.connect(this.recorder);this.recorder.connect(context.destination);
  }
  send(event){if(this.closed||this.socket?.readyState!==1)return;if(this.socket.bufferedAmount>128000){this.fail('The connection is too slow for a voice call. Please try again.');return;}this.socket.send(JSON.stringify(event));}
  event(event){
   const call=this.call;
   if(event.type==='ready'){clearTimeout(this.startTimer);this.ready=true;call.status=call.muted?'muted':'listening';if(call.muted)this.send({type:'mute'});call.paint();return;}
   if(event.type==='error')return this.fail(event.message);
   if(event.type==='closed')return this.fail('The voice call ended.');
   if(event.type==='user.started'){this.stopAudio();this.inputIndex=null;this.outputIndex=null;this.playbackBlocked=true;call.status=call.muted?'muted':'listening';call.paint();}
   if(event.type==='user.text'||event.type==='user.done'){
    if(this.inputIndex===null){this.inputIndex=call.messages.length;call.messages.push({role:'user',content:''});}
    const message=call.messages[this.inputIndex];if(event.text)message.content=event.text.slice(0,6000);
    if(event.type==='user.done'){if(message.content.trim()){call.turns++;this.feedback(message.content);}call.status='thinking';}
    call.paint();
   }
   if(event.type==='assistant.text'||event.type==='assistant.done'){
    if(this.outputIndex===null){this.outputIndex=call.messages.length;call.messages.push({role:'assistant',content:''});}
    const message=call.messages[this.outputIndex];if(event.type==='assistant.text'&&message.fromAudio)return;if(event.text)message.content=(event.type==='assistant.done'?event.text:message.content+event.text).slice(0,12000);call.paint();
   }
   if(event.type==='audio.started'){this.playbackBlocked=false;this.playbackFailed=false;if(call.error===playbackNotice)call.error='';if(event.text&&this.outputIndex===null){this.outputIndex=call.messages.length;call.messages.push({role:'assistant',content:event.text,fromAudio:true});call.paint();}}
   if(event.type==='audio'&&!this.playbackBlocked&&!this.playbackFailed){
    try{this.play(event.audio);}catch{
     this.playbackFailed=true;this.stopAudio();call.error=playbackNotice;
     call.status=call.muted?'muted':'listening';call.paint();
    }
   }
   if(event.type==='audio.done'){this.outputIndex=null;this.inputIndex=null;if(!this.sources.size){call.status=call.muted?'muted':'listening';call.paint();}}
   if(event.type==='interrupted'){this.stopAudio();call.status=call.muted?'muted':'listening';call.paint();}
   if(event.type==='recognition.failed'){this.inputIndex=null;call.error='That turn was not clear. Please try again.';call.status=call.muted?'muted':'listening';call.paint();}
  }
  async feedback(text){
   const call=this.call,sequence=++this.feedbackSequence,epoch=call.epoch;
   if(!call.config.feedback)return;
   const history=call.messages.slice(0,this.inputIndex).filter(m=>m.content?.trim()).slice(-24).map(m=>({role:m.role,content:m.content.slice(0,2400)}));
   try{const response=await call.request('/api/voice/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({scenario:call.scenario,text:text.slice(0,2400),history})});const result=await response.json();if(!this.closed&&epoch===call.epoch&&sequence===this.feedbackSequence){call.feedback=result;call.paint();}}
   catch{if(!this.closed&&epoch===call.epoch&&sequence===this.feedbackSequence){call.feedback={unavailable:true};call.paint();}}
  }
  play(base64){
   const raw=atob(base64);if(!raw.length||raw.length%2||raw.length>300000)throw Error('Invalid PCM');
   if(this.nextAt-this.context.currentTime>12)throw Error('Playback too far behind');
   const buffer=this.context.createBuffer(1,raw.length/2,24000),samples=buffer.getChannelData(0);
   for(let i=0;i<samples.length;i++){let value=raw.charCodeAt(i*2)|(raw.charCodeAt(i*2+1)<<8);if(value>=32768)value-=65536;samples[i]=value/32768;}
   const source=this.context.createBufferSource();source.buffer=buffer;source.connect(this.context.destination);this.sources.add(source);const generation=this.generation;
   source.onended=()=>{this.sources.delete(source);source.disconnect();if(!this.closed&&generation===this.generation&&!this.sources.size){this.call.status=this.call.muted?'muted':'listening';this.call.paint();}};
   this.nextAt=Math.max(this.context.currentTime+.04,this.nextAt);source.start(this.nextAt);this.nextAt+=buffer.duration;
   if(this.call.status!=='speaking'){this.call.status='speaking';this.call.paint();}
  }
  stopAudio(){this.generation++;for(const source of this.sources){source.onended=null;try{source.stop();}catch{}source.disconnect();}this.sources.clear();this.nextAt=0;}
  interrupt(){this.playbackBlocked=true;this.stopAudio();this.send({type:'interrupt'});this.outputIndex=null;this.call.status=this.call.muted?'muted':'listening';this.call.paint();}
  mute(muted){this.send({type:muted?'mute':'unmute'});}
  finish(){this.send({type:'finish'});}
  fail(message){if(this.closed)return;this.call.end(false);this.call.error=message;this.call.paint();}
  close(){if(this.closed)return;this.send({type:'end'});this.closed=true;clearTimeout(this.startTimer);this.stopAudio();if(this.recorder){this.recorder.port.onmessage=null;this.recorder.disconnect();}this.source?.disconnect();const socket=this.socket;if(socket){socket.onmessage=null;socket.onerror=null;socket.onclose=null;if(socket.readyState===0||socket.readyState===1)socket.close();}this.ready=false;}
 }
 root.SpeakiDoubaoCall=DoubaoCall;
})(globalThis);
