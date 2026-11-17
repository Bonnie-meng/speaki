import test from 'node:test';
import assert from 'node:assert/strict';
import {synthesizeSpeech,validateSpeechRequest,validateWav,createSpeechCache} from './natural-speech.mjs';
const wav=()=>{const bytes=Buffer.alloc(48);bytes.write('RIFF',0);bytes.writeUInt32LE(40,4);bytes.write('WAVE',8);return bytes;};
test('natural voice uses only the official DeepSeek endpoint and a fixed voice',async()=>{
 const result=await synthesizeSpeech({text:'Treasure.'},{env:{DEEPSEEK_API_KEY:'test-only-key'},fetchImpl:async(url,request)=>{
  assert.equal(url,'https://api.deepseek.com/v1/tools/tts');assert.equal(request.headers.Authorization,'Bearer test-only-key');
  assert.deepEqual(JSON.parse(request.body),{text:'Treasure.',voice_id:'stella',format:'wav',filter_markdown:false});
  return new Response(wav(),{headers:{'Content-Type':'audio/wav'}});
 }});assert.equal(result.type,'audio/wav');assert.equal(result.synthetic,true);
});
test('invalid input, authentication errors and truncated audio never become speech',async()=>{
 assert.throws(()=>validateSpeechRequest({text:''}));assert.throws(()=>validateSpeechRequest({text:'x'.repeat(1501)}));
 assert.throws(()=>validateWav(Buffer.alloc(50)));const broken=wav();broken.writeUInt32LE(999,4);assert.throws(()=>validateWav(broken));
 await assert.rejects(synthesizeSpeech({text:'Hello'},{env:{},fetchImpl:()=>{throw Error('Must not run');}}),/needs a DeepSeek/);
 await assert.rejects(synthesizeSpeech({text:'Hello'},{env:{DEEPSEEK_API_KEY:'test-only-key'},fetchImpl:async()=>new Response('',{status:402})}),/insufficient API balance/);
});
test('repeat and simultaneous play requests share generated audio; failed requests can retry',async()=>{
 let requests=0;const speech=createSpeechCache({generate:async()=>{requests++;return {bytes:wav(),type:'audio/wav'};}});
 await Promise.all([speech({text:'Hello'}),speech({text:'Hello'})]);await speech({text:'Hello'});assert.equal(requests,1);
 let attempts=0;const retry=createSpeechCache({generate:async()=>{if(++attempts===1)throw Error('Unavailable');return {bytes:wav(),type:'audio/wav'};}});
 await assert.rejects(retry({text:'Hello'}));await retry({text:'Hello'});assert.equal(attempts,2);
});
