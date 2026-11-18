import {WebSocket,WebSocketServer} from 'ws';
import {randomUUID} from 'node:crypto';
import {scenarios} from './voice-agent.mjs';
export const DOUBAO_ENDPOINT='wss://openspeech.bytedance.com/api/v3/duplex/realtime/dialogue';
export const doubaoConfigured=(env=process.env)=>Boolean(env.DOUBAO_REALTIME_API_KEY?.trim());
export function doubaoSession(scenario,env=process.env){
 if(!Object.hasOwn(scenarios,scenario))throw Error('Choose a conversation scenario.');
 return {type:'session.create',event_id:randomUUID(),session:{model:'1.2.6.1',instructions:`You are Stella, a patient English conversation partner for a Chinese-speaking B1 learner. ${scenarios[scenario].brief} Speak clear, natural American English at a comfortable pace. Normally use 15–45 words and ask one question at a time. Help the learner communicate, and allow time for hesitation. Correct at most one important grammar or wording mistake naturally, without interrupting every sentence. If asked about pronunciation, distinguish a possible issue from a confirmed error; never invent phoneme diagnoses or pronunciation/IELTS scores. You are an AI practice partner, not an examiner.`,audio:{input:{format:{type:'pcm',sample_rate:16000}},output:{format:{type:'pcm_s16le',sample_rate:24000},voice:env.DOUBAO_REALTIME_VOICE||'zh_female_vv_jupiter_bigtts',speed:-10,loudness:0}}},extension:{extra:{enable_proactive_speak:false}}};
}
// The browser receives only bounded, normalised events, never provider credentials/session IDs.
export function normaliseDoubaoEvent(event){
 const t=event.type,text=[event.text,event.delta,event.transcript,event.content].find(v=>typeof v==='string')||'';
 if(t==='session.created')return {type:'ready'};
 if(t==='session.closed')return {type:'closed'};
 if(t==='conversation.item.input_audio_transcription.started')return {type:'user.started'};
 if(t==='conversation.item.input_audio_transcription.delta')return {type:'user.text',text:text.slice(0,6000)};
 if(t==='conversation.item.input_audio_transcription.completed')return {type:'user.done',text:text.slice(0,6000)};
 if(t==='conversation.item.input_audio_transcription.failed')return {type:'recognition.failed'};
 if(t==='response.output_text.delta')return {type:'assistant.text',text:text.slice(0,6000)};
 if(t==='response.output_text.done')return {type:'assistant.done',text:text.slice(0,6000)};
 if(t==='response.output_audio.delta'){const audio=event.audio||event.delta;if(typeof audio!=='string'||audio.length>400000||!/^[A-Za-z0-9+/]*={0,2}$/.test(audio))throw Error('Invalid provider audio');return {type:'audio',audio};}
 if(t==='response.output_audio.started')return {type:'audio.started',text:text.slice(0,6000)};
 if(t==='response.output_audio.done')return {type:'audio.done'};
 if(t==='response.canceled')return {type:'interrupted'};
 if(t==='error')return {type:'error',message:'Doubao could not continue this call. Check the service activation, API credit and voice configuration, then call again.'};
 return null;
}
export function attachDoubaoRealtime(server,{accounts,accountHttp,resolveUser,env=process.env,connect=options=>new WebSocket(DOUBAO_ENDPOINT,options),maxDurationMs=30*60*1000,authIntervalMs=15000}={}){
 const wss=new WebSocketServer({noServer:true,maxPayload:8192,perMessageDeflate:false});const live=new Set(),users=new Set();
 const authenticate=req=>{accountHttp.checkOrigin(req);if(!req.headers.origin)throw Object.assign(Error('Open the call from Speaki.'),{status:403});const user=resolveUser?resolveUser(req):accountHttp.requireUser(req);if(!user)throw Object.assign(Error('Sign in again.'),{status:401});if(user.mustChangePassword)throw Object.assign(Error('Change your password first.'),{status:428});return user;};
 server.on('upgrade',(req,socket,head)=>{
  let user,scenario;
  try{const url=new URL(req.url,'http://localhost');if(url.pathname!=='/api/voice/realtime')throw Object.assign(Error(),{status:404});user=authenticate(req);scenario=url.searchParams.get('scenario');if(!Object.hasOwn(scenarios,scenario))throw Object.assign(Error(),{status:400});if(!doubaoConfigured(env))throw Object.assign(Error(),{status:503});if(live.size>=3||users.has(user.id))throw Object.assign(Error(),{status:429});accounts.rate('voice-start:'+user.id,12,60000);}
  catch(error){socket.end(`HTTP/1.1 ${error.status||403} Rejected\r\nConnection: close\r\nContent-Length: 0\r\n\r\n`);return;}
  wss.handleUpgrade(req,socket,head,client=>{
   users.add(user.id);
   const state={client,upstream:null};live.add(state);let ready=false,ended=false,windowAt=Date.now(),frames=0,bytes=0,lastPong=Date.now();
   const send=data=>{if(client.readyState===WebSocket.OPEN){if(client.bufferedAmount>1024*1024)return shutdown();client.send(JSON.stringify(data));}};
   const shutdown=(message)=>{if(ended)return;ended=true;clearTimeout(deadline);clearTimeout(handshake);clearInterval(auth);live.delete(state);users.delete(user.id);if(message)send({type:'error',message});const up=state.upstream;if(up?.readyState===WebSocket.OPEN){up.send(JSON.stringify({type:'session.close'}));const timeout=setTimeout(()=>up.terminate(),1200);timeout.unref();up.once('close',()=>clearTimeout(timeout));}else up?.terminate();if(client.readyState===WebSocket.OPEN)client.close(1000);else client.terminate();};
   const deadline=setTimeout(()=>shutdown('This call reached 30 minutes. Start a new call to continue.'),maxDurationMs);
   const handshake=setTimeout(()=>shutdown('Doubao did not connect. Check the service connection and try again.'),15000);
   const auth=setInterval(()=>{try{if(Date.now()-lastPong>45000)throw Error();client.ping();if(authenticate(req).id!==user.id)throw Error();}catch{shutdown('Your session ended. Please sign in again.');}},authIntervalMs);
   client.on('pong',()=>{lastPong=Date.now();});client.on('error',()=>shutdown());client.on('close',()=>shutdown());
   try{const up=connect({headers:{'X-Api-Key':env.DOUBAO_REALTIME_API_KEY,'X-Api-Connect-Id':randomUUID()},handshakeTimeout:12000,maxPayload:1024*1024,perMessageDeflate:false});state.upstream=up;
    up.on('open',()=>{if(ended){up.terminate();return;}up.send(JSON.stringify(doubaoSession(scenario,env)));});
    up.on('message',(data,binary)=>{if(ended){try{if(JSON.parse(data.toString()).type==='session.closed')up.close();}catch{}return;}try{if(binary)throw Error();const event=normaliseDoubaoEvent(JSON.parse(data.toString()));if(!event)return;if(event.type==='ready'){ready=true;clearTimeout(handshake);send(event);up.send(JSON.stringify({type:'speech_text_buffer.commit',text:scenarios[scenario].opening}));return;}if(event.type==='closed'){up.close();return shutdown();}send(event);if(event.type==='error')shutdown();}catch{shutdown('The voice response was incomplete. Please start a new call.');}});
    up.on('error',()=>shutdown('Doubao could not connect. Check that Seeduplex is activated and the API Key has access.'));up.on('close',()=>shutdown(ended?undefined:'The voice connection ended. Please call again.'));
   }catch{shutdown('Doubao could not connect. Please try again.');}
   client.on('message',(data,binary)=>{
    if(ended||!ready)return;
    try{if(binary)throw Error();if(Date.now()-windowAt>1000){windowAt=Date.now();frames=0;bytes=0;}frames++;bytes+=data.length;if(frames>80||bytes>80000)throw Error();const input=JSON.parse(data.toString());let event;
     if(input.type==='audio'&&typeof input.audio==='string'&&input.audio.length===856&&/^[A-Za-z0-9+/]+={0,2}$/.test(input.audio)&&Buffer.from(input.audio,'base64').length===640)event={type:'input_audio_buffer.append',audio:input.audio};
     else if(['mute','unmute','finish','interrupt','end'].includes(input.type))event={type:({mute:'input_audio_mute.commit',unmute:'input_audio_unmute.commit',finish:'input_audio_buffer.commit',interrupt:'response.cancel',end:'session.close'})[input.type]};else throw Error();
     if(input.type==='end')return shutdown();if(state.upstream.bufferedAmount>256000)return shutdown('The connection is too slow. Please call again.');state.upstream.send(JSON.stringify(event));
    }catch{shutdown('The microphone stream was interrupted. Please call again.');}
   });
  });
 });
 const close=()=>{for(const {client,upstream} of live){upstream?.terminate();client.terminate();}wss.close();};server.once('close',close);return {close};
}
