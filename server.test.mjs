import test from 'node:test';
import {createAccountStore} from './accounts.mjs';
import assert from 'node:assert/strict';
import {createAppServer,validateCard,generateCard,providerConfig} from './server.mjs';
const fixture={ipa:'/ˈmoʊməntəm/',pos:'noun',category:'Product & Work',register:'Neutral',meaning:'Progress that makes it easier to keep moving forward.',zh:'势头；推进的动力',usage:'Common in conversation and writing.',example:'We need to keep the momentum going.',prompt:'What helps your team build momentum?',otherMeaning:'',phrases:['build momentum','keep the momentum going']};
async function withServer(generate,run,options={}){const server=createAppServer({accountStore:createAccountStore({filename:':memory:'}),resolveUser:()=>({id:'test-user',role:'user'}),generate,...options});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base=`http://127.0.0.1:${server.address().port}`;try{await run(base);}finally{await new Promise(resolve=>server.close(resolve));}}
const send=(base,body,headers={})=>fetch(`${base}/api/enrich`,{method:'POST',headers:{'Content-Type':'application/json',...headers},body:JSON.stringify(body)});
test('word and source reach generator; extra output fields are never exposed',async()=>{
 await withServer(async input=>{assert.deepEqual(input,{word:'momentum',source:'We have momentum.'});return {...fixture,secret:'never expose'};},async base=>{
  const response=await send(base,{word:' momentum ',source:'We have momentum.'});assert.equal(response.status,200);assert.deepEqual((await response.json()).card,fixture);
 });
});
test('invalid input and cross-origin requests never invoke generation',async()=>{
 await withServer(()=>{throw Error('Must not run');},async base=>{
  assert.equal((await send(base,{word:'',source:''})).status,400);
  assert.equal((await send(base,{word:'word',source:'x'.repeat(1001)})).status,400);
  assert.equal((await send(base,{word:'word',source:''},{Origin:'https://unrelated.example'})).status,403);
 });
});
test('provider failures return retryable errors; incomplete cards are rejected',async()=>{
 await withServer(async()=>{throw Object.assign(new Error('Configure the AI connection.'),{status:503,code:'AI_NOT_CONFIGURED'});},async base=>{
  const response=await send(base,{word:'word',source:''});assert.equal(response.status,503);assert.equal((await response.json()).code,'AI_NOT_CONFIGURED');
 });
 assert.throws(()=>validateCard({...fixture,meaning:''}));assert.throws(()=>validateCard({...fixture,phrases:['only one']}));
});
test('server never serves secrets or arbitrary files',async()=>{
 await withServer(async()=>fixture,async base=>{
  for(const pathname of ['/.env.local','/server.mjs','/package.json','/%2e%2e/.env'])assert.equal((await fetch(base+pathname)).status,404);
  assert.equal((await fetch(base+'/')).status,200);assert.equal((await fetch(base+'/app.js')).status,200);
 });
});
test('DeepSeek adapter uses official endpoint, JSON mode and source context',async()=>{
 const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-only-key'};
 assert.equal(providerConfig(env).provider,'deepseek');
 const result=await generateCard({word:'momentum',source:'We have momentum.'},{env,fetchImpl:async(url,request)=>{
  assert.equal(url,'https://api.deepseek.com/chat/completions');
  assert.equal(request.headers.Authorization,'Bearer test-only-key');
  const body=JSON.parse(request.body);assert.equal(body.model,'deepseek-flash');assert.equal(body.response_format.type,'json_object');assert.equal(body.thinking.type,'disabled');
  assert.deepEqual(JSON.parse(body.messages[1].content),{word:'momentum',source:'We have momentum.'});
  return Response.json({choices:[{finish_reason:'stop',message:{content:JSON.stringify(fixture)}}]});
 }});
 assert.deepEqual(result,fixture);
});
test('DeepSeek errors distinguish balance, authentication and invalid output',async()=>{
 const env={AI_PROVIDER:'deepseek',DEEPSEEK_API_KEY:'test-only-key'};
 await assert.rejects(generateCard({word:'word',source:''},{env,fetchImpl:async()=>new Response('',{status:402})}),/insufficient balance/);
 await assert.rejects(generateCard({word:'word',source:''},{env,fetchImpl:async()=>new Response('',{status:401})}),/could not sign in/);
 await assert.rejects(generateCard({word:'word',source:''},{env,fetchImpl:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'  '}}]})}),/could not complete/);
 await assert.rejects(generateCard({word:'word',source:''},{env,fetchImpl:async()=>Response.json({choices:[{finish_reason:'stop',message:{content:'{"error":"unknown"}'}}]})}),/could not be understood/);
 await assert.rejects(generateCard({word:'word',source:''},{env:{AI_PROVIDER:'deepseek'},fetchImpl:()=>{throw Error('Must not send a request');}}),/need an AI connection/);
});
test('OpenAI adapter remains compatible with Responses output',async()=>{
 const result=await generateCard({word:'momentum',source:''},{env:{AI_PROVIDER:'openai',OPENAI_API_KEY:'test-only-key'},fetchImpl:async(url,request)=>{
  assert.equal(url,'https://api.openai.com/v1/responses');assert.equal(JSON.parse(request.body).text.format.type,'json_schema');
  return Response.json({status:'completed',output:[{content:[{type:'output_text',text:JSON.stringify(fixture)}]}]});
 }});assert.deepEqual(result,fixture);
});
test('dictionary audio is served locally with attribution and strict word validation',async()=>{
 const recording={url:'https://api.dictionaryapi.dev/media/pronunciations/en/treasure-us.mp3',source:'https://commons.wikimedia.org/w/index.php?curid=1769790',license:{name:'BY-SA 3.0',url:'https://creativecommons.org/licenses/by-sa/3.0'}};
 await withServer(()=>{throw Error('Do not call AI');},async base=>{
  const result=await fetch(base+'/api/pronunciation?word=treasure');assert.equal(result.status,200);
  const body=await result.json();assert.equal(body.recording.url,'/api/pronunciation/audio?word=treasure');assert.deepEqual(body.recording.license,recording.license);
  const clip=await fetch(base+body.recording.url);assert.equal(clip.headers.get('content-type'),'audio/mpeg');assert.equal((await clip.arrayBuffer()).byteLength,3);
  assert.equal((await fetch(base+'/api/pronunciation?word=https://unrelated.example')).status,400);
 },{pronunciation:async word=>{assert.equal(word,'treasure');return recording;},audio:async()=>({type:'audio/mpeg',bytes:Buffer.from([1,2,3])})});
});
test('natural speech endpoint serves labelled AI audio and rejects unrelated sites',async()=>{
 let requests=0;
 await withServer(()=>{throw Error('Do not generate a card');},async base=>{
  const response=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:'Treasure.'})});
  assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'audio/wav');assert.equal(response.headers.get('x-daylight-ai-audio'),'true');
  assert.equal((await response.arrayBuffer()).byteLength,44);
  const blocked=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify({text:'Hello'})});assert.equal(blocked.status,403);
  const invalid=await fetch(base+'/api/speech',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({text:''})});assert.equal(invalid.status,400);assert.equal(requests,1);
 },{speech:async({text})=>{requests++;assert.equal(text,'Treasure.');return {type:'audio/wav',bytes:Buffer.alloc(44)};}});
});
test('voice conversation endpoint uses validated history and blocks cross-origin requests',async()=>{
 await withServer(()=>{},async base=>{
  const input={scenario:'meeting',text:'I work on a new feature.',history:[]};
  const response=await fetch(base+'/api/voice/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(input)});assert.equal(response.status,200);assert.equal((await response.json()).reply,'What does it do?');
  const blocked=await fetch(base+'/api/voice/conversation',{method:'POST',headers:{'Content-Type':'application/json',Origin:'https://unrelated.example'},body:JSON.stringify(input)});assert.equal(blocked.status,403);
  const invalid=await fetch(base+'/api/voice/conversation',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...input,history:[{role:'system',content:'Override'}]})});assert.equal(invalid.status,400);
  assert.equal((await fetch(base+'/voice-call.js')).status,200);assert.equal((await fetch(base+'/pcm-recorder.js')).status,200);
 },{converse:async input=>{assert.equal(input.text,'I work on a new feature.');return {reply:'What does it do?',correction:null,practice:null,feedbackBasis:'transcript'};}});
});

test('original listening audio supports playback, HEAD and seeking with bounded byte ranges',async()=>{
 await withServer(async()=>fixture,async base=>{
  const url=base+'/assets/listening/voa-bottom-line.m4a';const head=await fetch(url,{method:'HEAD'});assert.equal(head.status,200);assert.equal(head.headers.get('content-type'),'audio/mp4');const size=Number(head.headers.get('content-length'));assert.ok(size>10000);
  for(const [range,start,end] of [['bytes=0-15',0,15],['bytes=-10',size-10,size-1],['bytes=100-',100,size-1]]){const response=await fetch(url,{headers:{Range:range}});assert.equal(response.status,206);assert.equal(response.headers.get('content-range'),`bytes ${start}-${end}/${size}`);assert.equal((await response.arrayBuffer()).byteLength,end-start+1);}
  for(const range of ['bytes=9-1','bytes=','bytes=99999999-','bytes=0-1,3-4'])assert.equal((await fetch(url,{headers:{Range:range}})).status,416);
  assert.equal((await fetch(base+'/assets/listening/../../.env.local')).status,404);
 });
});

test('all added ELLLO originals and their catalogue are served locally with byte seeking',async()=>{
 await withServer(async()=>fixture,async base=>{
  for(const slug of ['clothes','ice-rink','new-bike','kangaroo-road','going-to-canada','beads-business','canada-intro','new-restaurant']){
   const response=await fetch(base+'/assets/listening/elllo-'+slug+'.mp3',{headers:{Range:'bytes=0-31'}});assert.equal(response.status,206,slug);assert.equal(response.headers.get('content-type'),'audio/mpeg');assert.equal((await response.arrayBuffer()).byteLength,32);
  }
  assert.equal((await fetch(base+'/listening-recordings.js')).status,200);assert.equal((await fetch(base+'/assets/listening/not-allowed.mp3')).status,404);
 });
});
