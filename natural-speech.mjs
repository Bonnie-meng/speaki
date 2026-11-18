import {synthesizeDoubao} from './doubao-speech.mjs';
const endpoint='https://api.deepseek.com/v1/tools/tts';
const maxBytes=6*1024*1024;
export function validateSpeechRequest(input){
 if(!input||typeof input.text!=='string'||!input.text.trim()||input.text.length>1500)throw Object.assign(new Error('Enter up to 1,500 characters to read aloud.'),{status:400});
 return {text:input.text.trim()};
}
export function validateWav(bytes){
 if(bytes.length<44||bytes.length>maxBytes||bytes.toString('ascii',0,4)!=='RIFF'||bytes.toString('ascii',8,12)!=='WAVE')throw Object.assign(new Error('The voice service returned incomplete audio. Please try again.'),{status:502});
 // Streaming WAV may use 0xffffffff as an unknown length; reject truncated fixed-length WAV.
 const declared=bytes.readUInt32LE(4);if(declared!==0xffffffff&&declared+8>bytes.length)throw Object.assign(new Error('The recording was cut off. Please try again.'),{status:502});
 return bytes;
}
export async function synthesizeSpeech(input,{env=process.env,fetchImpl=fetch}={}){
 const {text}=validateSpeechRequest(input);
 if(env.DOUBAO_REALTIME_API_KEY?.trim())return synthesizeDoubao(text,{env});
 if(!env.DEEPSEEK_API_KEY)throw Object.assign(new Error('Natural speech needs a DeepSeek API connection. Your vocabulary is unchanged.'),{status:503});
 const response=await fetchImpl(endpoint,{method:'POST',signal:AbortSignal.timeout(45000),headers:{Authorization:`Bearer ${env.DEEPSEEK_API_KEY}`,'Content-Type':'application/json'},body:JSON.stringify({text,voice_id:'stella',format:'wav',filter_markdown:false})});
 if(!response.ok){const messages={401:'The voice service could not sign in. Check the DeepSeek API key.',402:'The DeepSeek account has insufficient API balance for speech.',429:'The voice service is busy. Please try again shortly.'};throw Object.assign(new Error(messages[response.status]||'Natural speech is unavailable right now. Please try again; no system voice will be substituted.'),{status:502});}
 if(!response.headers.get('content-type')?.toLowerCase().startsWith('audio/wav'))throw Object.assign(new Error('The voice service returned an unsupported recording. Please try again.'),{status:502});
 const chunks=[];let length=0;
 for await(const chunk of response.body){length+=chunk.length;if(length>maxBytes)throw Object.assign(new Error('This recording is too long. Try a shorter sentence.'),{status:502});chunks.push(chunk);}
 return {type:'audio/wav',bytes:validateWav(Buffer.concat(chunks)),voice:'DeepSeek Stella',synthetic:true};
}
export function createSpeechCache({generate=synthesizeSpeech,maxEntries=100,maxTotalBytes=32*1024*1024}={}){
 const cache=new Map(),pending=new Map();let totalBytes=0;
 return async input=>{
  const request=validateSpeechRequest(input),key=request.text;
  if(cache.has(key)){const clip=cache.get(key);cache.delete(key);cache.set(key,clip);return clip;}
  if(pending.has(key))return pending.get(key);
  if(pending.size>=3)throw Object.assign(new Error('A few recordings are loading. Please try again in a moment.'),{status:429});
  const job=(async()=>{const clip=await generate(request);
   if(clip.bytes.length<=maxTotalBytes){while(cache.size&&(cache.size>=maxEntries||totalBytes+clip.bytes.length>maxTotalBytes)){const oldest=cache.keys().next().value;totalBytes-=cache.get(oldest).bytes.length;cache.delete(oldest);}cache.set(key,clip);totalBytes+=clip.bytes.length;}
   return clip;
  })();pending.set(key,job);try{return await job;}finally{pending.delete(key);}
 };
}
