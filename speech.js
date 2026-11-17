// Deliberately allow normal English voices; macOS also exposes novelty sound effects.
(function(root){
 const preferred=[/Google US English/i,/Microsoft (Aria|Jenny|Guy).*Natural/i,/^Samantha(?:\b|$)/i,/^Alex(?:\b|$)/i,/^(Ava|Allison|Susan|Tom|Nicky|Nathan|Zoe|Evan|Joelle)(?:\b|$)/i,/Microsoft (Aria|Jenny|Guy|Zira|David)/i];
 const novelty=/Albert|Bad News|Good News|Bells|Boing|Bubbles|Cellos|Deranged|Hysterical|Jester|Organ|Superstar|Trinoids|Whisper|Zarvox|Wobble|Bahh|Fred|Ralph/i;
 function chooseVoice(voices){
  const candidates=voices.filter(v=>v.lang?.replace('_','-').toLowerCase()==='en-us'&&!novelty.test(v.name));
  for(const pattern of preferred){const voice=candidates.find(v=>pattern.test(v.name));if(voice)return voice;}
  // Do not fall back to the first arbitrary voice or to the browser default.
  return null;
 }
 function selectRecording(entries){
  if(!Array.isArray(entries))return null;
  for(const entry of entries){
   for(const phonetic of entry.phonetics||[]){
    if(typeof phonetic.audio!=='string')continue;
    let url;try{url=new URL(phonetic.audio);}catch{continue;}
    if(url.protocol!=='https:'||url.hostname!=='api.dictionaryapi.dev'||!url.pathname.startsWith('/media/pronunciations/en/'))continue;
    if(!/(?:-us(?:\.|-)|en-us-)/i.test(url.pathname))continue;
    let source=null,license=null;
    try{const u=new URL(phonetic.sourceUrl);if(u.protocol==='https:'&&u.hostname==='commons.wikimedia.org')source=u.href;}catch{}
    try{const u=new URL(phonetic.license?.url);if(u.protocol==='https:'&&u.hostname==='creativecommons.org')license={url:u.href,name:String(phonetic.license.name||'License')};}catch{}
    return {url:url.href,source,license};
   }
  }
  return null;
 }
 function readyVoice(synth,timeout=1500){
  const voice=chooseVoice(synth.getVoices());if(voice)return Promise.resolve(voice);
  return new Promise(resolve=>{
   let timer;
   const finish=()=>{const selected=chooseVoice(synth.getVoices());if(!selected)return;clearTimeout(timer);synth.removeEventListener('voiceschanged',finish);resolve(selected);};
   timer=setTimeout(()=>{synth.removeEventListener('voiceschanged',finish);resolve(chooseVoice(synth.getVoices()));},timeout);
   synth.addEventListener('voiceschanged',finish);
  });
 }
 root.DaylightSpeech={chooseVoice,selectRecording,readyVoice};
})(globalThis);
