import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {pcmToWav,synthesizeDoubao} from './doubao-speech.mjs';
test('PCM is wrapped with matching sample rate, byte rate and data length',()=>{
 const wav=pcmToWav(Buffer.from([0,64,0,192]));assert.equal(wav.toString('ascii',0,4),'RIFF');assert.equal(wav.readUInt32LE(24),24000);assert.equal(wav.readUInt32LE(28),48000);assert.equal(wav.readUInt32LE(40),4);assert.equal(wav.readInt16LE(44),16384);assert.equal(wav.readInt16LE(46),-16384);assert.throws(()=>pcmToWav(Buffer.alloc(3)));
});
test('Doubao synthesis reads exact text, returns playable PCM and closes the session',async()=>{
 let socket;const sent=[];
 class MockSocket extends EventEmitter{
  constructor(){super();this.readyState=1;queueMicrotask(()=>this.emit('open'));}
  send(raw){const event=JSON.parse(raw);sent.push(event);if(event.type==='session.create')queueMicrotask(()=>this.emit('message',Buffer.from('{"type":"session.created"}')));if(event.type==='speech_text_buffer.commit')queueMicrotask(()=>{this.emit('message',Buffer.from(JSON.stringify({type:'response.output_audio.delta',delta:Buffer.alloc(960).toString('base64')})));this.emit('message',Buffer.from('{"type":"response.output_audio.done"}'));});if(event.type==='session.close')queueMicrotask(()=>this.emit('message',Buffer.from('{"type":"session.closed"}')));}
  close(){this.readyState=3;this.emit('close');}terminate(){this.close();}
 }
 const clip=await synthesizeDoubao('clarify',{env:{DOUBAO_REALTIME_API_KEY:'test-only'},connect:options=>{assert.equal(options.headers['X-Api-Key'],'test-only');return socket=new MockSocket();}});
 assert.equal(clip.bytes.length,1004);assert.equal(clip.voice,'Doubao English voice');assert.equal(sent.find(e=>e.type==='speech_text_buffer.commit').text,'clarify');assert.ok(sent.some(e=>e.type==='session.close'));assert.equal(socket.readyState,3);
});
