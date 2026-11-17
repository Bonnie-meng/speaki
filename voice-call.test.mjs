import test from 'node:test';
import assert from 'node:assert/strict';
import './voice-utils.js';
import './voice-call.js';
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(condition){for(let i=0;i<100;i++){if(condition())return;await pause(5);}throw Error('Call state did not settle');}
function setup({microphone}={}){
 let stopped=0,closed=0;const track={enabled:true,stop(){stopped++;}};const stream={getTracks:()=>[track],getAudioTracks:()=>[track]};
 globalThis.window=globalThis;globalThis.document={querySelector:()=>null};
 Object.defineProperty(globalThis,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia:microphone||(async()=>stream)}}});
 globalThis.AudioContext=class{constructor(){this.sampleRate=48000;this.audioWorklet={addModule:async()=>{}};this.destination={};}resume(){return Promise.resolve();}createMediaStreamSource(){return {connect(){},disconnect(){}};}close(){closed++;return Promise.resolve();}};
 globalThis.AudioWorkletNode=class{constructor(){this.port={};}connect(){}disconnect(){}};
 globalThis.Audio=class{constructor(){this.onended=null;}async play(){setTimeout(()=>this.onended?.(),10);}pause(){}};
 const requests=[];globalThis.fetch=async(url,options)=>{
  requests.push(url);
  if(url==='/api/speech')return new Response(new Blob([Buffer.alloc(44)],{type:'audio/wav'}));
  if(url==='/api/voice/transcribe')return Response.json({text:'I am work on a new feature.'});
  if(url==='/api/voice/conversation'){const body=JSON.parse(options.body);assert.equal(body.text,'I am work on a new feature.');return Response.json({reply:'What problem does it solve?',correction:{original:'I am work',better:'I am working',why:'Use working.'},practice:null,feedbackBasis:'transcript'});}
  throw Error('Unexpected request');
 };
 return {stream,track,requests,stopped:()=>stopped,closed:()=>closed};
}
test('a synthetic microphone turn is transcribed, answered aloud, and microphone stops on hangup',async()=>{
 const fixture=setup();let counted=0;const call=new globalThis.DaylightVoiceCall({onPractice:()=>counted++});
 await call.start();await until(()=>call.status==='listening');call.listenAfter=0;
 for(let i=0;i<6;i++)call.samples(new Float32Array(4800).fill(.08));
 for(let i=0;i<15;i++)call.samples(new Float32Array(4800));
 await until(()=>call.turns===1&&call.status==='listening');
 assert.equal(call.messages.at(-1).content,'What problem does it solve?');assert.equal(call.feedback.correction.better,'I am working');assert.ok(fixture.requests.includes('/api/voice/transcribe'));assert.equal(fixture.requests.filter(v=>v==='/api/speech').length,2);
 call.toggleMute();assert.equal(fixture.track.enabled,false);call.end(false);assert.equal(fixture.stopped(),1);assert.equal(fixture.closed(),1);assert.equal(counted,1);assert.equal(call.active,false);
});
test('hanging up while microphone permission is pending releases a late stream and never starts a call',async()=>{
 let grant;const fixture=setup({microphone:()=>new Promise(resolve=>{grant=resolve;})});const call=new globalThis.DaylightVoiceCall();
 const starting=call.start();call.end(false);grant(fixture.stream);await starting;
 assert.equal(fixture.stopped(),1);assert.equal(call.active,false);assert.equal(fixture.requests.length,0);
});

test('clearing an account removes voice transcripts, recordings and feedback and releases microphone resources',async()=>{
 const fixture=setup();const call=new globalThis.DaylightVoiceCall();await call.start();await until(()=>call.status==='listening');
 call.messages.push({role:'user',content:'Private previous-account conversation'});call.feedback={correction:{original:'private',better:'private correction'}};call.assessment={reference:'private recording'};call.lastClip=new Blob(['private audio']);call.draft='private draft';
 call.clearPrivateState();assert.deepEqual(call.messages,[]);assert.equal(call.feedback,null);assert.equal(call.assessment,null);assert.equal(call.lastClip,null);assert.equal(call.draft,'');assert.equal(call.active,false);assert.equal(call.status,'idle');assert.equal(fixture.stopped(),1);
});
