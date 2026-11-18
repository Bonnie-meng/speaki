import {WebSocket} from 'ws';
import {DOUBAO_ENDPOINT,doubaoSession} from './doubao-realtime.mjs';
export function pcmToWav(pcm,rate=24000){
 if(!pcm.length||pcm.length%2||pcm.length>5*1024*1024)throw Error('Invalid speech audio');
 const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);return Buffer.concat([header,pcm]);
}
export function synthesizeDoubao(text,{env=process.env,connect=options=>new WebSocket(DOUBAO_ENDPOINT,options)}={}){
 return new Promise((resolve,reject)=>{
  const chunks=[];let bytes=0,settled=false,socket;
  const close=()=>{if(socket?.readyState===WebSocket.OPEN){socket.send(JSON.stringify({type:'session.close'}));const grace=setTimeout(()=>socket.terminate(),1000);grace.unref();socket.once('close',()=>clearTimeout(grace));}else socket?.terminate();};
  const finish=(error,clip)=>{if(settled)return;settled=true;clearTimeout(timer);close();error?reject(Object.assign(Error(error),{status:502})):resolve(clip);};
  const timer=setTimeout(()=>finish('The English voice took too long. Please try again.'),45000);
  try{socket=connect({headers:{'X-Api-Key':env.DOUBAO_REALTIME_API_KEY},handshakeTimeout:12000,maxPayload:1024*1024,perMessageDeflate:false});
   socket.on('open',()=>{const event=doubaoSession('everyday',env);event.session.audio.output.speed=0;socket.send(JSON.stringify(event));});
   socket.on('message',data=>{let event;try{event=JSON.parse(data);}catch{return finish('The English recording was incomplete. Please try again.');}
    if(settled){if(event.type==='session.closed')socket.close();return;}
    if(event.type==='session.created'){socket.send(JSON.stringify({type:'input_audio_mute.commit'}));socket.send(JSON.stringify({type:'speech_text_buffer.commit',text}));}
    if(event.type==='response.output_audio.delta'){try{const raw=event.delta||event.audio;if(typeof raw!=='string'||!/^[A-Za-z0-9+/]*={0,2}$/.test(raw))throw Error();const pcm=Buffer.from(raw,'base64');bytes+=pcm.length;if(bytes>5*1024*1024)throw Error();chunks.push(pcm);}catch{finish('The English recording was incomplete. Please try again.');}}
    if(event.type==='response.output_audio.done'){try{finish(null,{type:'audio/wav',bytes:pcmToWav(Buffer.concat(chunks)),voice:'Doubao English voice',synthetic:true});}catch{finish('The English recording was incomplete. Please try again.');}}
    if(event.type==='error')finish('Doubao could not generate this recording. Check the speech service access and balance.');
   });
   socket.on('error',()=>finish('The English voice could not connect. Please try again.'));socket.on('close',()=>{if(!settled)finish('The English recording ended early. Please try again.');});
  }catch{finish('The English voice could not connect. Please try again.');}
 });
}
