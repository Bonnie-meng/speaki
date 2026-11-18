import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {EventEmitter,once} from 'node:events';
import {WebSocket} from 'ws';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
import {attachDoubaoRealtime,doubaoSession,normaliseDoubaoEvent} from './doubao-realtime.mjs';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause(5);}throw Error('Timed out');}
class Upstream extends EventEmitter{
 constructor(){super();this.readyState=0;this.bufferedAmount=0;this.sent=[];queueMicrotask(()=>{this.readyState=1;this.emit('open');});}
 send(text){const data=JSON.parse(text);this.sent.push(data);if(data.type==='session.close')queueMicrotask(()=>this.emit('message',Buffer.from('{"type":"session.closed"}'),false));}
 close(){this.readyState=3;this.emit('close');}terminate(){this.close();}
 event(event){this.emit('message',Buffer.from(JSON.stringify(event)),false);}
}
async function fixture(t,{key='fake-test-key',authIntervalMs=15}={}){
 const server=http.createServer((q,s)=>s.end());let valid=true,connects=0;const upstreams=[],options=[];
 const bridge=attachDoubaoRealtime(server,{accounts:{rate(){}},accountHttp:{checkOrigin(req){if(req.headers.origin!=='http://127.0.0.1')throw Object.assign(Error(),{status:403});},requireUser(req){if(!valid||req.headers.cookie!=='test=session')throw Object.assign(Error(),{status:401});return {id:'test-user'};}},env:{DOUBAO_REALTIME_API_KEY:key},authIntervalMs,connect:opts=>{connects++;options.push(opts);const up=new Upstream();upstreams.push(up);return up;}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(async()=>{bridge.close();await new Promise(r=>server.close(r));});
 const url=`ws://127.0.0.1:${server.address().port}/api/voice/realtime?scenario=meeting`;
 const client=(headers={Origin:'http://127.0.0.1',Cookie:'test=session'})=>new WebSocket(url,{headers});return {client,url,upstreams,options,connects:()=>connects,invalidate:()=>{valid=false;}};
}
test('session uses the fixed official protocol, PCM formats and server-selected teacher scenario',()=>{
 const event=doubaoSession('meeting',{});assert.equal(event.session.model,'1.2.6.1');assert.equal(event.session.audio.input.format.sample_rate,16000);assert.equal(event.session.audio.output.format.type,'pcm_s16le');assert.match(event.session.instructions,/trade-offs/);assert.throws(()=>doubaoSession('__proto__'));assert.equal(normaliseDoubaoEvent({type:'response.done',secret:'never forward'}),null);
 assert.deepEqual(normaliseDoubaoEvent({type:'conversation.item.input_audio_transcription.delta',text:'hello',session:{id:'private'}}),{type:'user.text',text:'hello'});
});
test('realtime relay authenticates, hides credentials, streams audio and closes provider on hangup',async t=>{
 const f=await fixture(t);const client=f.client(),received=[];client.on('message',v=>received.push(JSON.parse(v)));await once(client,'open');await until(()=>f.upstreams[0]?.sent.length);const up=f.upstreams[0];assert.equal(up.sent[0].type,'session.create');assert.equal(f.options[0].headers['X-Api-Key'],'fake-test-key');
 up.event({type:'session.created',session:{id:'private-provider-id'}});await until(()=>received.length);assert.deepEqual(received[0],{type:'ready'});assert.equal(up.sent[1].type,'speech_text_buffer.commit');
 const pcm=Buffer.alloc(640).toString('base64');client.send(JSON.stringify({type:'audio',audio:pcm}));await until(()=>up.sent.some(v=>v.type==='input_audio_buffer.append'));
 up.event({type:'response.output_audio.delta',delta:Buffer.alloc(960).toString('base64')});await until(()=>received.some(v=>v.type==='audio'));assert.ok(!JSON.stringify(received).includes('private-provider-id'));
 client.send(JSON.stringify({type:'mute'}));await until(()=>up.sent.some(v=>v.type==='input_audio_mute.commit'));client.send(JSON.stringify({type:'interrupt'}));await until(()=>up.sent.some(v=>v.type==='response.cancel'));client.send(JSON.stringify({type:'end'}));await once(client,'close');assert.ok(up.sent.some(v=>v.type==='session.close'));
});
test('missing key, cross-site, missing Origin and unsigned connections never reach provider',async t=>{
 for(const [key,headers,status] of [['',undefined,503],['x',{Origin:'https://elsewhere',Cookie:'test=session'},403],['x',{Cookie:'test=session'},403],['x',{Origin:'http://127.0.0.1'},401]]){
  const f=await fixture(t,{key});const client=f.client(headers);client.on('error',()=>{});const [,response]=await once(client,'unexpected-response');assert.equal(response.statusCode,status);response.resume();client.terminate();assert.equal(f.connects(),0);
 }
});
test('a second call for the same user is rejected and logout terminates the active call',async t=>{
 const f=await fixture(t);const client=f.client();await once(client,'open');const second=f.client();second.on('error',()=>{});const [,response]=await once(second,'unexpected-response');assert.equal(response.statusCode,429);response.resume();second.terminate();f.invalidate();await once(client,'close');assert.equal(f.connects(),1);
});
test('malformed audio is rejected without forwarding, provider errors never expose secrets',async t=>{
 const f=await fixture(t);const client=f.client(),received=[];client.on('message',v=>received.push(JSON.parse(v)));await once(client,'open');await until(()=>f.upstreams[0]);const up=f.upstreams[0];up.event({type:'session.created'});await until(()=>received.length);client.send(JSON.stringify({type:'audio',audio:'not-pcm'}));await once(client,'close');assert.ok(!up.sent.some(v=>v.type==='input_audio_buffer.append'));assert.ok(!JSON.stringify(normaliseDoubaoEvent({type:'error',message:'fake-test-key secret'})).includes('fake-test-key'));
});
test('streaming recorder emits continuous exact PCM frames at 44.1 and 48 kHz without drift',async()=>{
 const source=await readFile(new URL('./pcm-recorder.js',import.meta.url),'utf8');
 for(const rate of [44100,48000]){const processors={},frames=[];const sandbox={sampleRate:rate,AudioWorkletProcessor:class{constructor(){this.port={postMessage:buffer=>frames.push(new Uint8Array(buffer).slice())};}},registerProcessor:(name,cls)=>{processors[name]=cls;}};vm.runInNewContext(source,sandbox);const recorder=new processors['speaki-realtime-recorder']();for(let n=0;n<rate*2;n+=128)recorder.process([[new Float32Array(Math.min(128,rate*2-n)).fill(.25)]],[[new Float32Array(128)]]);assert.equal(frames.length,100);assert.ok(frames.every(v=>v.length===640));const view=new DataView(frames[0].buffer);assert.ok(Math.abs(view.getInt16(0,true)-8192)<=1);}
});

test('realtime client keeps the microphone streaming during replies, updates captions and clears queued audio on interrupt',async()=>{
 const source=await readFile(new URL('./doubao-call.js',import.meta.url),'utf8');const sent=[],tracks=[],sockets=[];
 class Socket{constructor(){this.readyState=1;this.bufferedAmount=0;sockets.push(this);}send(v){sent.push(JSON.parse(v));}close(){this.readyState=3;}}
 const context={currentTime:0,destination:{},createMediaStreamSource:()=>({connect(){},disconnect(){}}),createBuffer:(channels,length,rate)=>({duration:length/rate,getChannelData:()=>new Float32Array(length)}),createBufferSource:()=>{const node={connect(){},disconnect(){},start(){},stop(){node.stopped=true;}};tracks.push(node);return node;}};
 const call={muted:false,status:'connecting',messages:[],config:{feedback:false},turns:0,paint(){},end(){this.ended=true;transport.close();}};
 const sandbox={WebSocket:Socket,AudioWorkletNode:class{constructor(){this.port={};}connect(){}disconnect(){}},URL,location:{href:'http://localhost/',protocol:'http:'},setTimeout,clearTimeout,atob,btoa};vm.runInNewContext(source,sandbox);const transport=new sandbox.SpeakiDoubaoCall(call);await transport.start({},context);transport.event({type:'ready'});assert.equal(call.status,'listening');
 transport.event({type:'assistant.text',text:'Hello!'});transport.event({type:'audio.started'});transport.event({type:'audio',audio:Buffer.alloc(960).toString('base64')});assert.equal(call.status,'speaking');transport.recorder.port.onmessage({data:new ArrayBuffer(640)});assert.equal(sent.at(-1).type,'audio');
 transport.event({type:'user.started'});assert.equal(tracks[0].stopped,true);transport.event({type:'user.text',text:'I am'});transport.event({type:'user.text',text:'I am learning English.'});transport.event({type:'user.done',text:''});assert.equal(call.turns,1);assert.equal(call.messages.at(-1).content,'I am learning English.');
 transport.mute(true);assert.equal(sent.at(-1).type,'mute');transport.interrupt();assert.equal(sent.at(-1).type,'interrupt');transport.close();assert.equal(sent.at(-1).type,'end');assert.equal(sockets[0].readyState,3);const count=call.messages.length;sockets[0].onmessage?.({data:'{"type":"assistant.text","text":"late"}'});assert.equal(call.messages.length,count);
});
