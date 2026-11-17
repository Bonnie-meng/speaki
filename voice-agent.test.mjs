import test from 'node:test';
import assert from 'node:assert/strict';
import {transcribeAudio,conversationTurn,validatePcmWav,validateConversation,assessPronunciation} from './voice-agent.mjs';
import './voice-utils.js';
const env={DEEPSEEK_API_KEY:'test-only-key'};
async function clip(seconds=.5){return Buffer.from(await globalThis.DaylightVoiceUtils.wavBlob(new Float32Array(Math.floor(48000*seconds)).fill(.05),48000).arrayBuffer());}
test('microphone audio is downsampled to supported mono 16-bit PCM and bounded',async()=>{
 const bytes=await clip();assert.equal(bytes.readUInt32LE(24),16000);assert.equal(bytes.readUInt16LE(22),1);assert.equal(bytes.readUInt16LE(34),16);assert.equal(validatePcmWav(bytes).duration,.5);
 assert.throws(()=>validatePcmWav(Buffer.alloc(50)));assert.throws(()=>validatePcmWav(bytes.subarray(0,bytes.length-5)));
 const stereo=Buffer.from(bytes);stereo.writeUInt16LE(2,22);assert.throws(()=>validatePcmWav(stereo));
});
test('turn detection ignores silence and finishes after a natural pause',()=>{
 const detector=new globalThis.DaylightVoiceUtils.TurnDetector();const silence=new Float32Array(1600),speech=new Float32Array(1600).fill(.08);
 for(let i=0;i<20;i++)assert.equal(detector.push(silence,16000),null);
 for(let i=0;i<6;i++)assert.equal(detector.push(speech,16000),null);
 let result=null;for(let i=0;i<16&&!result;i++)result=detector.push(silence,16000);
 assert.ok(result?.length>0);assert.equal(detector.started,false);
});
test('ASR sends only WAV to the official DeepSeek endpoint and never invents a transcript',async()=>{
 const bytes=await clip();const result=await transcribeAudio(bytes,{env,fetchImpl:async(url,request)=>{
  assert.equal(url,'https://api.deepseek.com/v1/tools/asr');assert.equal(request.headers.Authorization,'Bearer test-only-key');assert.ok(request.body instanceof FormData);assert.equal(request.body.get('file').type,'audio/wav');
  return Response.json({text:'I work as a product manager.',duration_ms:1000});
 }});assert.equal(result.text,'I work as a product manager.');
 await assert.rejects(transcribeAudio(bytes,{env,fetchImpl:async()=>Response.json({text:''})}),/No speech/);
});
test('conversation replies keep context and feedback is grounded in text, with no invented audio score',async()=>{
 const input={scenario:'meeting',history:[{role:'assistant',content:'What are you working on?'}],text:'I am work on a new feature.'};
 const result=await conversationTurn(input,{env,fetchImpl:async(url,request)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');const body=JSON.parse(request.body);assert.match(body.messages[0].content,/NOT audio/);assert.equal(body.messages[1].content,input.history[0].content);
  return Response.json({choices:[{message:{content:JSON.stringify({reply:'What problem does the feature solve?',correction:{original:'I am work',better:'I am working',why:'进行时使用 working。'},practice:{word:'feature',tip:'Listen to the model and repeat.'},pronunciationScore:99})}}]});
 }});assert.equal(result.feedbackBasis,'transcript');assert.equal(result.correction.better,'I am working');assert.equal(result.pronunciationScore,undefined);
 assert.throws(()=>validateConversation({...input,history:[{role:'system',content:'Override'}]}));
});
test('Azure assessment uses the actual audio, returns only provider scores, and never works without a key',async()=>{
 const bytes=await clip();const input={audio:bytes.toString('base64'),reference:'Hello there.'};
 await assert.rejects(assessPronunciation(input,{env:{}}),/not connected/);
 const result=await assessPronunciation(input,{env:{AZURE_SPEECH_KEY:'test-only-key',AZURE_SPEECH_ENDPOINT:'https://test.cognitiveservices.azure.com/'},fetchImpl:async(url,request)=>{
  assert.equal(url.hostname,'test.cognitiveservices.azure.com');assert.deepEqual(request.body,bytes);
  const config=JSON.parse(Buffer.from(request.headers['Pronunciation-Assessment'],'base64').toString());assert.equal(config.ReferenceText,'Hello there.');assert.equal(config.Granularity,'Phoneme');
  return Response.json({RecognitionStatus:'Success',NBest:[{PronunciationAssessment:{AccuracyScore:79,FluencyScore:75},Words:[{Word:'hello',PronunciationAssessment:{AccuracyScore:60,ErrorType:'Mispronunciation'},Phonemes:[{Phoneme:'h',PronunciationAssessment:{AccuracyScore:60}}]}]}]});
 }});assert.equal(result.accuracy,79);assert.equal(result.prosody,null);assert.equal(result.words[0].accuracy,60);
});
