(function(root){
function validate(data){
  if(!data||data.version!==1||!Array.isArray(data.words)||data.words.length>10000||!data.activity||typeof data.activity!=='object'||Array.isArray(data.activity)||!data.drafts||typeof data.drafts!=='object'||Array.isArray(data.drafts)||!data.focus||!Number.isFinite(data.focus.seconds)||data.focus.seconds<0||typeof data.focus.day!=='string')throw Error('Invalid backup');
  root.DaylightListening.validateProgress(data.listening);
  root.SpeakiLibraryProgress.validate(data.library);
  if(JSON.stringify(data).length>5*1024*1024)throw Error('Backup is too large');
  const ids=new Set();
  for(const w of data.words){if(!w||typeof w.id!=='string'||!/^[a-zA-Z0-9_-]+$/.test(w.id)||ids.has(w.id)||typeof w.word!=='string'||!w.word.trim()||w.word.length>100||!['Everyday','Product & Work','IELTS'].includes(w.category)||!['new','learning','usable','pending'].includes(w.status)||!Array.isArray(w.phrases)||w.phrases.some(p=>typeof p!=='string')||typeof w.due!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(w.due)||!Number.isFinite(w.reviews)||w.reviews<0)throw Error('Invalid word');ids.add(w.id);for(const k of ['ipa','pos','register','meaning','zh','example','source','createdAt'])if(typeof w[k]!=='string')throw Error('Invalid word field');if(w.prompt!==undefined&&typeof w.prompt!=='string')throw Error('Invalid prompt');if(w.libraryId!==undefined&&!root.SpeakiLibraryProgress.idPattern.test(w.libraryId))throw Error('Invalid library reference');}
  for(const value of Object.values(data.drafts))if(typeof value!=='string')throw Error('Invalid notes');
  for(const value of Object.values(data.activity))if(!value||!Number.isFinite(value.reviews)||!Number.isFinite(value.practices))throw Error('Invalid activity');
}
 root.DaylightState={validate};
})(globalThis);
