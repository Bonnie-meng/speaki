(function(root){
 const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const playIcon='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="m8 5 11 7-11 7V5Z"/></svg>';
 const speakerIcon='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5Z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a10 10 0 0 1 0 14"/></svg>';
 const pauseIcon='<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M6 5h4v14H6zm8 0h4v14h-4z"/></svg>';
 const normalize=word=>word.replace(/[’‘]/g,"'").trim().toLowerCase();
 function transcriptParts(text){
  const sentences=typeof Intl.Segmenter==='function'?[...new Intl.Segmenter('en',{granularity:'sentence'}).segment(text)].map(s=>s.segment):text.match(/[^.!?]+[.!?]*/g)||[text];
  let id=0;
  return sentences.map(sentence=>{
   const parts=[];let at=0;
   for(const match of sentence.matchAll(/[A-Za-z]+(?:[’'-][A-Za-z]+)*/g)){
    if(match.index>at)parts.push({text:sentence.slice(at,match.index)});
    parts.push({text:match[0],word:match[0].replace(/[’‘]/g,"'"),sentence:sentence.trim(),id:id++});at=match.index+match[0].length;
   }
   if(at<sentence.length)parts.push({text:sentence.slice(at)});return parts;
  });
 }
 // Join sentence recordings without re-encoding; cue boundaries use real PCM durations.
 async function sentenceAudio(sentences,getClip,isCurrent=()=>true){
  const clips=[];let format,byteRate,total=0;const cues=[];
  for(const sentence of sentences){
   const blob=await getClip(sentence.trim());if(!isCurrent())return null;
   const buffer=await blob.arrayBuffer(),view=new DataView(buffer),bytes=new Uint8Array(buffer);
   const tag=at=>String.fromCharCode(...bytes.slice(at,at+4));let fmt,data;
   if(bytes.length<44||tag(0)!=='RIFF'||tag(8)!=='WAVE')throw Error('The recording could not be synchronized. Please try again.');
   for(let at=12;at+8<=bytes.length;){const size=view.getUint32(at+4,true),end=Math.min(at+8+size,bytes.length);
    if(tag(at)==='fmt ')fmt=bytes.slice(at+8,end);
    if(tag(at)==='data'){data=bytes.slice(at+8,end);break;}
    at+=8+size+(size%2);
   }
   if(!fmt||fmt.length<16||!data)throw Error('The recording is incomplete. Please try again.');
   const f=new DataView(fmt.buffer,fmt.byteOffset,fmt.byteLength),encoding=f.getUint16(0,true);
   if(![1,3].includes(encoding)||!f.getUint32(8,true)||!f.getUint16(12,true)||data.length%f.getUint16(12,true))throw Error('This recording format cannot be synchronized.');
   if(format&&(fmt.length!==format.length||fmt.some((b,i)=>b!==format[i])))throw Error('The sentence recordings have different audio formats. Please try again.');
   format=fmt;byteRate=f.getUint32(8,true);
   cues.push({start:total/byteRate,end:(total+data.length)/byteRate});clips.push(data);total+=data.length;
  }
  const pad=format.length%2,header=new Uint8Array(28+format.length+pad),h=new DataView(header.buffer);
  const tag=(at,text)=>[...text].forEach((c,i)=>header[at+i]=c.charCodeAt(0));
  tag(0,'RIFF');h.setUint32(4,header.length+total+(total%2)-8,true);tag(8,'WAVE');tag(12,'fmt ');h.setUint32(16,format.length,true);header.set(format,20);
  tag(20+format.length+pad,'data');h.setUint32(24+format.length+pad,total,true);
  return {blob:new Blob([header,...clips,...(total%2?[new Uint8Array(1)]:[])],{type:'audio/wav'}),cues};
 }
 function cueAt(cues,position){return cues.findIndex((cue,i)=>position>=cue.start&&(position<cue.end||(i===cues.length-1&&position===cue.end)));}
 const time=seconds=>Number.isFinite(seconds)?`${Math.floor(seconds/60)}:${String(Math.floor(seconds%60)).padStart(2,'0')}`:'–:––';
 const sceneOf=lesson=>lesson.scene||lesson.category;
 const originOf=lesson=>lesson.source.countries||[];
 const providerOf=lesson=>lesson.source.provider||(lesson.source.name?.includes('VOA')?'VOA':'Original');
 const levelName=level=>({A2:'Elementary',B1:'Intermediate',B2:'Upper intermediate'}[level]||level);
 const studyTime=seconds=>{const value=Math.max(0,Math.floor(seconds||0));return value>=3600?`${Math.floor(value/3600)}:${String(Math.floor(value%3600/60)).padStart(2,'0')}:${String(value%60).padStart(2,'0')}`:`${Math.floor(value/60)}:${String(value%60).padStart(2,'0')}`;};
 // Count real elapsed time only when the media clock advances; jumps and stalls never add time.
 function validateProgress(progress){
  if(progress===undefined)return;
  if(!progress||typeof progress!=='object'||Array.isArray(progress)||Object.keys(progress).length>1000)throw Error('Invalid listening history');
  for(const [id,value] of Object.entries(progress))if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,99}$/.test(id)||!value||typeof value!=='object'||!Number.isFinite(value.seconds)||value.seconds<0||!Number.isFinite(value.position)||value.position<0||typeof value.completed!=='boolean'||typeof value.updatedAt!=='string')throw Error('Invalid listening history');
 }
 class StudyClock{
  constructor(now=()=>performance.now()){this.now=now;this.running=false;}
  start(position){this.position=position;this.stamp=this.now();this.running=true;}
  sample(position,rate=1){if(!this.running)return 0;const wall=Math.max(0,(this.now()-this.stamp)/1000),media=position-this.position;this.stamp=this.now();this.position=position;return media>0?Math.min(wall,media/rate):0;}
  stop(position,rate){const seconds=this.sample(position,rate);this.running=false;return seconds;}
 }
 class ListeningPlayer{
  constructor({lessons,initialLessonId,getProgress=()=>null,onProgress=()=>{},getClip,onPlaybackStart=()=>{},onAddWord=()=>{},getSavedWord=()=>null,onPractice=()=>{},onSpeakWord=()=>{}}){
   Object.assign(this,{lessons,getClip,getProgress,onProgress,onPlaybackStart,onAddWord,getSavedWord,onPractice,onSpeakWord,index:0,rate:1,transcriptVisible:false,wantPlaying:false,playing:false,loading:false,position:0,duration:NaN,error:'',epoch:0,wordEpoch:0,lookupCache:new Map(),completed:new Set(),cues:[],activeSentence:-1,libraryOpen:true,sceneFilter:'all',levelFilter:'all',sourceFilter:'all',countryFilter:'all',sort:'scene',pendingSeconds:0});
   const initial=lessons.findIndex(l=>l.id===initialLessonId);if(initial>=0)this.index=initial;this.studyClock=new StudyClock();this.position=this.stats().position||0;this.buildTokens();
  }
  get lesson(){return this.lessons[this.index];}
  buildTokens(){this.parts=this.lesson.segments?this.lesson.segments.map(segment=>transcriptParts(segment.text).flat()):transcriptParts(this.lesson.script);this.tokens=this.parts.flat().filter(p=>p.word);this.tokens.forEach((token,id)=>token.id=id);}
  view(){
   if(this.libraryOpen)return this.libraryView();
   const l=this.lesson,source=l.source;
   const transcript=this.parts.map((parts,i)=>`<p data-listen-sentence="${i}">${parts.map(p=>p.word?`<button type="button" class="transcript-word" data-listen-word="${p.id}" aria-label="Look up ${escape(p.text)}">${escape(p.text)}</button>`:escape(p.text)).join('')}</p>`).join('');
   return `<div id="listening-shell"><div class="listening-study-header"><button class="text-button" data-listen="library">← Listening library</button><span id="listening-study-time">${studyTime((this.stats().seconds||0)+this.pendingSeconds)} studied</span></div><div class="listening-layout"><section class="listening-card"><div class="listening-material-meta"><span class="tag ${l.category==='Product & Work'?'work':''}">${escape(l.category)}</span><span>${escape(l.level)}</span><span>${source.kind==='synthetic'?'AI-generated audio':'Human recording'}</span></div><h2>${escape(l.title)}</h2><div class="listening-player"><div class="listening-main-controls"><button class="listening-play" data-listen="toggle" aria-label="Play listening audio">${playIcon}<span id="listening-play-label">Play</span></button><button class="listening-restart" data-listen="restart" aria-label="Restart listening audio" title="Start from the beginning">↺</button><label class="listening-speed">Speed <select id="listening-speed" aria-label="Playback speed">${[.5,.8,1,1.2,1.5].map(r=>`<option value="${r}" ${r===this.rate?'selected':''}>${r.toFixed(1)}×</option>`).join('')}</select></label></div><div class="listening-timeline"><span id="listening-position">${time(this.position)}</span><input type="range" id="listening-seek" aria-label="Audio position" min="0" max="${Number.isFinite(this.duration)?this.duration:0}" step="0.1" value="${this.position}" ${Number.isFinite(this.duration)?'':'disabled'}><span id="listening-duration">${time(this.duration)}</span></div><p id="listening-player-status" class="notice" role="status" aria-live="polite">${this.error?escape(this.error):'Audio is prepared on your first play. Pause and resume keep your place.'}</p></div><div class="listening-transcript-heading"><h3>Transcript</h3><button class="button secondary" data-listen="transcript" aria-expanded="${this.transcriptVisible}" aria-controls="listening-transcript">${this.transcriptVisible?'Hide transcript':'Show transcript'}</button></div><p class="listening-transcript-hint">${this.transcriptVisible?'Tap a word to see its meaning.':''}</p><div id="listening-transcript" class="listening-transcript" ${this.transcriptVisible?'':'hidden'}>${transcript}</div><details class="listening-source"><summary>About this material</summary><dl><dt>Script</dt><dd>${escape(source.name)}</dd><dt>Audio</dt><dd>${source.kind==='synthetic'?'AI-generated · ':''}${escape(source.voice||'Original recording')}</dd><dt>Accent</dt><dd>${escape(source.accent)}</dd>${source.country?`<dt>Country / region</dt><dd>${escape(source.country)}</dd>`:''}${source.credit?`<dt>Credit</dt><dd>${escape(source.credit)}</dd>`:''}${source.license?`<dt>Use</dt><dd>${escape(source.license)}</dd>`:''}</dl>${source.url?`<a href="${escape(source.url)}" target="_blank" rel="noopener noreferrer">Original source ↗</a>${source.licenseUrl?` · <a href="${escape(source.licenseUrl)}" target="_blank" rel="noopener noreferrer">Usage terms ↗</a>`:''}`:''}<p class="notice">${source.kind==='synthetic'?'This is an original practice script, not an excerpt from a programme or course. It is not a verified regional-accent sample.':escape(source.note||'Original recording with a matching transcript.')}</p></details></section><aside class="listening-side"><section class="practice-card"><h3>What did you catch?</h3><ol>${l.questions.map(q=>`<li>${escape(q)}</li>`).join('')}</ol><details><summary>Check the answers</summary><ol>${l.answers.map(a=>`<li>${escape(a)}</li>`).join('')}</ol></details></section><section class="practice-card"><h3>Useful expressions</h3><div class="phrase-list">${l.phrases.map(p=>`<span>${escape(p)}</span>`).join('')}</div><button class="button secondary listening-complete" data-listen="complete">${this.completed.has(l.id)||this.stats().completed?'✓ Practice recorded':'✓ I listened & repeated'}</button></section></aside></div>${this.externalView()}<dialog id="listening-word-dialog" aria-labelledby="listening-word-title"></dialog></div>`;
  }
  stats(id=this.lesson.id){return this.getProgress(id)||{};}
  catalogue(){
   const rank={A2:0,B1:1,B2:2};
   return this.lessons.map((lesson,index)=>({lesson,index})).filter(({lesson:l})=>(this.sceneFilter==='all'||sceneOf(l)===this.sceneFilter)&&(this.levelFilter==='all'||l.level===this.levelFilter)&&(this.sourceFilter==='all'||l.source.kind===this.sourceFilter)&&(this.countryFilter==='all'||originOf(l).includes(this.countryFilter))).sort((a,b)=>{
    const level=(rank[a.lesson.level]??9)-(rank[b.lesson.level]??9),scene=sceneOf(a.lesson).localeCompare(sceneOf(b.lesson));
    return (this.sort==='level'?level||scene:scene||level)||Number(a.lesson.source.kind==='synthetic')-Number(b.lesson.source.kind==='synthetic')||a.lesson.title.localeCompare(b.lesson.title);
   });
  }
  libraryView(){
   const rows=this.catalogue(),scenes=[...new Set(this.lessons.map(sceneOf))].sort(),countries=[...new Set(this.lessons.flatMap(originOf))].sort(),total=this.lessons.reduce((sum,l)=>sum+(this.stats(l.id).seconds||0),0);
   let group='';const items=rows.map(({lesson:l,index})=>{const key=this.sort==='level'?`${l.level} · ${levelName(l.level)}`:sceneOf(l),heading=key!==group?`<h3 class="listening-library-group">${escape(key)}</h3>`:'';group=key;const progress=this.stats(l.id),duration=l.durationSeconds||Math.max(15,Math.round(l.script.split(/\s+/).length/130*60));
    return `${heading}<button class="listening-library-row" data-listen-lesson="${index}" aria-label="Study ${escape(l.title)}"><span class="listening-row-lesson"><strong>${escape(l.title)}</strong><span title="${escape(l.focus||sceneOf(l))}">${escape(sceneOf(l))} · ${escape(l.focus||'Listen and practise.')}</span><small class="listening-row-scene">${escape(sceneOf(l))}</small></span><span class="listening-row-level"><span class="tag ${l.category==='Product & Work'?'work':''}">${escape(l.level)}</span></span><span class="listening-row-source"><span>${l.source.kind==='recorded'?`Human · ${escape(providerOf(l))}`:'AI practice'}</span><small>${l.source.kind==='recorded'?escape(originOf(l).join(' / ')):'Generated English voice'}</small></span><span class="listening-row-length" aria-label="Recording length">${l.source.kind==='recorded'?'':'≈ '}${time(duration)}</span><span class="listening-row-studied" data-study-time="${escape(l.id)}" aria-label="Time studied">${studyTime(progress.seconds||0)}<small>studied</small></span><span class="listening-row-action">${progress.completed?'✓ Practised':progress.seconds>0?'Continue ↗':'Start ↗'}</span></button>`;
   }).join('');
   return `<div id="listening-shell"><section class="listening-library"><div class="listening-library-heading"><div><h2 class="sr-only">Find your next listen.</h2></div><span class="listening-total"><strong>${studyTime(total)}</strong> total listening</span></div><div class="listening-library-filters"><label>Scene<select id="listening-scene" aria-label="Filter listening by scene"><option value="all">All scenes</option>${scenes.map(scene=>`<option ${scene===this.sceneFilter?'selected':''}>${escape(scene)}</option>`).join('')}</select></label><label>Level<select id="listening-level" aria-label="Filter listening by level"><option value="all">All levels</option>${['A2','B1','B2'].map(level=>`<option value="${level}" ${level===this.levelFilter?'selected':''}>${level} · ${levelName(level)}</option>`).join('')}</select></label><label>Voice<select id="listening-source" aria-label="Filter listening by voice"><option value="all">All voices</option><option value="recorded" ${this.sourceFilter==='recorded'?'selected':''}>Human voices</option><option value="synthetic" ${this.sourceFilter==='synthetic'?'selected':''}>AI practice</option></select></label><label>Speaker origin<select id="listening-country" aria-label="Filter listening by speaker origin"><option value="all">All origins</option>${countries.map(country=>`<option ${country===this.countryFilter?'selected':''}>${escape(country)}</option>`).join('')}</select></label><label>Sort by<select id="listening-sort" aria-label="Sort listening materials"><option value="scene" ${this.sort==='scene'?'selected':''}>Scene, then level</option><option value="level" ${this.sort==='level'?'selected':''}>Level · easy to hard</option></select></label></div><div class="listening-library-note"><span>${rows.length} of ${this.lessons.length} lessons</span></div><div class="listening-list-columns" aria-hidden="true"><span>Lesson</span><span>Level</span><span>Voice / origin</span><span>Length</span><span>Studied</span><span></span></div><div class="listening-library-list">${items||'<p class="listening-library-empty">No lessons match these filters. Try another scene or level.</p>'}</div></section>${this.externalView()}</div>`;
  }
  addTime(seconds){if(seconds>0)this.pendingSeconds+=seconds;}
  flushProgress(force=false){
   if(!force&&this.pendingSeconds<5)return;
   if(!this.pendingSeconds&&!force)return;
   this.onProgress(this.lesson.id,{seconds:this.pendingSeconds,position:this.position,completed:this.completed.has(this.lesson.id)||Boolean(this.stats().completed)});this.pendingSeconds=0;
  }
  sampleTime(){this.addTime(this.studyClock.sample(this.audio?.currentTime??this.position,this.rate));this.flushProgress();}
  externalView(){
   const lessons=root.DaylightListeningExternal||[];if(!lessons.length)return '';
   return `<details class="listening-external"><summary>More free practice · British Council <span>4 B1 lessons ↗</span></summary><p>Audio, transcripts, and exercises on the original website. Opens in a new tab; Speaki’s player controls and word lookup apply to the lessons above.</p><div class="listening-external-grid">${lessons.map(l=>`<a href="${escape(l.url)}" target="_blank" rel="noopener noreferrer" data-listen-external><span class="eyebrow">${escape(l.category)} · B1 · Free</span><strong>${escape(l.title)} ↗</strong><span>${escape(l.focus)}</span><small>Open on British Council</small></a>`).join('')}</div></details>`;
  }
  mount(){
   this.host=document.querySelector('#listening-shell');if(!this.host)return;root.SpeakiControls?.refresh(this.host);
   this.host.onclick=e=>{if(e.target.closest('[data-listen-external]'))this.pause();const b=e.target.closest('button');if(!b)return;
    if(b.dataset.listenLesson!==undefined){this.select(Number(b.dataset.listenLesson));return;}
    if(b.dataset.listenWord!==undefined){this.lookup(Number(b.dataset.listenWord));return;}
    const action=b.dataset.listen;if(action==='library'){this.pause();this.libraryOpen=true;this.paint();this.host?.scrollIntoView?.({block:'start'});return;}if(action==='toggle')this.toggle();if(action==='restart')this.restart();if(action==='transcript'){this.transcriptVisible=!this.transcriptVisible;this.paint();}if(action==='complete'){if(!this.completed.has(this.lesson.id)&&!this.stats().completed){this.completed.add(this.lesson.id);this.flushProgress(true);this.onPractice();this.paint();}}if(action==='close-word')this.closeLookup();if(action==='lookup-retry')this.lookup(this.lookupToken.id);if(action==='save-word')this.saveWord();if(action==='speak-word'&&this.lookupCard)this.onSpeakWord({...this.lookupCard,word:this.lookupToken.word},b);
   };
   if(this.libraryOpen){for(const [id,key] of [['listening-scene','sceneFilter'],['listening-level','levelFilter'],['listening-source','sourceFilter'],['listening-country','countryFilter'],['listening-sort','sort']])this.host.querySelector('#'+id).onchange=e=>{this[key]=e.target.value;this.paint();this.host.querySelector('#'+id)?.focus({preventScroll:true});};return;}
   this.host.querySelector('#listening-speed').onchange=e=>this.setRate(Number(e.target.value));
   this.host.querySelector('#listening-seek').oninput=e=>this.seek(Number(e.target.value));
   this.host.querySelector('#listening-word-dialog').onclose=()=>{this.wordEpoch++;this.lookupOpen=false;};
   this.updateControls();this.syncTranscript(true);
  }
  paint(){const host=document.querySelector('#listening-shell');if(!host)return;host.outerHTML=this.view();this.mount();}
  updateControls(){
   const host=document.querySelector('#listening-shell');if(!host||this.libraryOpen)return;
   const studied=host.querySelector('#listening-study-time');if(studied)studied.textContent=`${studyTime((this.stats().seconds||0)+this.pendingSeconds)} studied`;
   const button=host.querySelector('[data-listen="toggle"]'),label=this.loading&&this.wantPlaying?'Cancel loading':this.playing?'Pause':this.position>0?'Resume':'Play';
   button.innerHTML=(this.playing?pauseIcon:playIcon)+`<span id="listening-play-label">${label}</span>`;button.setAttribute('aria-label',this.playing?'Pause listening audio':this.loading&&this.wantPlaying?'Cancel audio playback':this.position>0?'Resume listening audio':'Play listening audio');button.setAttribute('aria-busy',String(this.loading&&this.wantPlaying));
   host.querySelector('#listening-position').textContent=time(this.position);host.querySelector('#listening-duration').textContent=time(this.duration);
   const seek=host.querySelector('#listening-seek');seek.disabled=!Number.isFinite(this.duration);seek.max=Number.isFinite(this.duration)?this.duration:0;seek.value=this.position;
   host.querySelector('#listening-speed').value=this.rate;root.SpeakiControls?.refresh(host);
   const status=host.querySelector('#listening-player-status');status.textContent=this.error||(this.loading?'Preparing audio…':'');status.hidden=!status.textContent;status.classList.toggle('audio-error',Boolean(this.error));this.syncTranscript();
  }
  syncTranscript(force=false){
   if(!this.transcriptVisible)return;
   const host=document.querySelector('#listening-transcript');if(!host)return;
   const index=cueAt(this.cues,this.position),changed=index!==this.activeSentence;this.activeSentence=index;
   for(const line of host.querySelectorAll('[data-listen-sentence]')){
    const active=Number(line.dataset.listenSentence)===index;line.classList.toggle('is-current',active);
    if(active)line.setAttribute('aria-current','true');else line.removeAttribute('aria-current');
   }
   if(index<0||(!changed&&!force))return;
   const line=host.querySelector(`[data-listen-sentence="${index}"]`);
   if(line){const box=host.getBoundingClientRect(),rect=line.getBoundingClientRect();
    host.scrollTo({top:host.scrollTop+rect.top-box.top-(host.clientHeight-rect.height)/2,behavior:globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
   }
  }
  async ensureAudio(){
   if(this.audio)return this.audio;if(this.loadJob)return this.loadJob;
   const epoch=this.epoch,lesson=this.lesson;this.loading=true;this.updateControls();
   const job=(async()=>{
    const track=lesson.audioUrl?null:await sentenceAudio(this.parts.map(parts=>parts.map(p=>p.text).join('')),this.getClip,()=>epoch===this.epoch);
    if(!lesson.audioUrl&&!track)return null;
    const source=lesson.audioUrl||URL.createObjectURL(track.blob);
    if(epoch!==this.epoch){if(!lesson.audioUrl)URL.revokeObjectURL(source);return null;}
    this.cues=track?.cues||lesson.segments?.map(({start,end})=>({start,end}))||lesson.cues||[];this.audioUrl=lesson.audioUrl?null:source;const audio=new Audio(source);this.audio=audio;audio.preload='auto';audio.playbackRate=this.rate;audio.preservesPitch=true;
    audio.onloadedmetadata=()=>{if(epoch!==this.epoch)return;this.duration=Number.isFinite(audio.duration)?audio.duration:NaN;if(this.position>0&&Number.isFinite(this.duration))audio.currentTime=Math.min(this.position,this.duration);this.updateControls();};
    audio.ontimeupdate=()=>{if(epoch!==this.epoch)return;this.sampleTime();this.position=audio.currentTime;this.updateControls();};
    audio.onplaying=()=>{if(epoch===this.epoch&&this.wantPlaying)this.studyClock.start(audio.currentTime);};
    audio.onpause=()=>{if(epoch!==this.epoch)return;this.addTime(this.studyClock.stop(audio.currentTime,this.rate));this.position=audio.currentTime;this.playing=false;this.wantPlaying=false;this.flushProgress(true);this.updateControls();};
    audio.onwaiting=()=>{this.addTime(this.studyClock.stop(audio.currentTime,this.rate));this.flushProgress(true);};
    audio.onseeking=()=>{this.studyClock.running=false;};
    audio.onseeked=()=>{if(this.playing&&this.wantPlaying)this.studyClock.start(audio.currentTime);};
    audio.onended=()=>{if(epoch!==this.epoch)return;this.addTime(this.studyClock.stop(audio.currentTime,this.rate));this.position=0;this.flushProgress(true);this.playing=false;this.wantPlaying=false;this.position=0;audio.currentTime=0;this.updateControls();};
    audio.onerror=()=>{if(epoch!==this.epoch)return;const position=this.position;this.resetAudio();this.position=position;this.error='This audio could not play. Please try again.';this.updateControls();};
    return audio;
   })();this.loadJob=job;
   try{return await job;}finally{if(epoch===this.epoch){this.loading=false;this.loadJob=null;this.updateControls();}}
  }
  async play(){
   this.onPlaybackStart();this.wantPlaying=true;this.error='';this.updateControls();const epoch=this.epoch;
   try{const audio=await this.ensureAudio();if(epoch!==this.epoch||!this.wantPlaying||!audio)return;audio.playbackRate=this.rate;await audio.play();if(epoch!==this.epoch||!this.wantPlaying){audio.pause();return;}this.playing=true;this.studyClock.start(audio.currentTime);this.updateControls();}
   catch(error){if(epoch!==this.epoch)return;this.playing=false;this.wantPlaying=false;this.error=error.name==='NotAllowedError'?'Audio is ready. Tap Play again to start.':error.message||'Audio could not load. Please try again.';this.updateControls();}
  }
  pause(){this.addTime(this.studyClock.stop(this.audio?.currentTime??this.position,this.rate));this.wantPlaying=false;this.audio?.pause();this.playing=false;if(this.audio)this.position=this.audio.currentTime;this.flushProgress(true);this.updateControls();}
  toggle(){if(this.playing||this.wantPlaying)this.pause();else this.play();}
  seek(value){if(!this.audio||!Number.isFinite(this.duration))return;this.sampleTime();this.studyClock.running=false;this.position=Math.max(0,Math.min(value,this.duration));this.audio.currentTime=this.position;this.flushProgress(true);this.updateControls();}
  setRate(rate){if(![.5,.8,1,1.2,1.5].includes(rate))return;this.sampleTime();this.rate=rate;if(this.audio){this.audio.playbackRate=rate;this.audio.preservesPitch=true;}this.updateControls();}
  restart(){this.sampleTime();this.studyClock.running=false;this.position=0;if(this.audio)this.audio.currentTime=0;this.play();}
  select(index){if(!Number.isInteger(index)||!this.lessons[index])return;if(index===this.index){this.libraryOpen=false;this.paint();this.host?.scrollIntoView?.({block:'start'});return;}this.resetAudio();this.index=index;this.position=this.stats().position||0;this.libraryOpen=false;this.transcriptVisible=false;this.wordEpoch++;this.lookupOpen=false;this.buildTokens();this.paint();this.host?.scrollIntoView?.({block:'start'});}
  resetAudio(){this.epoch++;this.pause();if(this.audio){this.audio.onloadedmetadata=null;this.audio.ontimeupdate=null;this.audio.onended=null;this.audio.onerror=null;this.audio.onpause=null;this.audio.onplaying=null;this.audio.onwaiting=null;this.audio.onseeking=null;this.audio.onseeked=null;this.audio.src='';this.audio=null;}if(this.audioUrl)URL.revokeObjectURL(this.audioUrl);this.audioUrl=null;this.loadJob=null;this.loading=false;this.position=0;this.duration=NaN;this.cues=[];this.activeSentence=-1;this.error='';}
  leave(){this.pause();this.closeLookup();}
  destroy(){this.resetAudio();this.closeLookup();}
  async lookup(id){
   const token=this.tokens.find(t=>t.id===id);if(!token)return;this.pause();this.lookupToken=token;this.lookupCard=null;this.lookupError='';this.lookupOpen=true;const epoch=++this.wordEpoch;
   this.renderLookup();const dialog=document.querySelector('#listening-word-dialog');if(!dialog.open)dialog.showModal();
   const key=normalize(token.word)+'|'+token.sentence;
   try{
    let card=this.lookupCache.get(key);
    if(!card){const response=await fetch('/api/enrich',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({word:token.word,source:token.sentence}),signal:AbortSignal.timeout(90000)});const body=await response.json();if(!response.ok)throw Error(body.error||'The meaning could not load. Please try again.');card=body.card;
     if(!card||['ipa','pos','category','register','meaning','zh','usage','example','prompt','otherMeaning'].some(k=>typeof card[k]!=='string')||!card.zh.trim()||!card.meaning.trim()||!Array.isArray(card.phrases)||card.phrases.some(p=>typeof p!=='string'))throw Error('The word details were incomplete. Please try again.');if(this.lookupCache.size>=100)this.lookupCache.delete(this.lookupCache.keys().next().value);this.lookupCache.set(key,card);
    }
    if(epoch!==this.wordEpoch||!this.lookupOpen)return;this.lookupCard=card;this.renderLookup();
   }catch(error){if(epoch!==this.wordEpoch||!this.lookupOpen)return;this.lookupError=error.name==='TimeoutError'?'The lookup took too long. Please try again.':error.message;this.renderLookup();}
  }
  renderLookup(){
   const dialog=document.querySelector('#listening-word-dialog');if(!dialog||!this.lookupToken)return;const t=this.lookupToken,c=this.lookupCard,saved=this.getSavedWord(t.word);
   dialog.innerHTML=`<div class="modal-heading"><div><span class="eyebrow">FROM YOUR LISTENING</span><h2 id="listening-word-title">${escape(t.word)}</h2></div><button class="icon-button" data-listen="close-word" aria-label="Close word lookup">×</button></div>${c?`<div class="lookup-pronunciation"><span class="ipa">${escape(c.ipa)} · ${escape(c.pos)}</span><button class="audio-button" data-listen="speak-word" aria-label="Hear ${escape(t.word)} pronounced">${speakerIcon} Listen</button></div><p class="lookup-chinese">${escape(c.zh)}</p><p class="lookup-english">${escape(c.meaning)}</p>`:this.lookupError?`<p class="capture-note" role="alert">${escape(this.lookupError)}</p><button class="button secondary" data-listen="lookup-retry">Try again ↻</button>`:'<p class="lookup-loading" role="status">Preparing the meaning in this sentence…</p>'}<div class="lookup-context"><span class="eyebrow">IN THIS SENTENCE</span><p>${escape(t.sentence)}</p></div>${c?`<div class="phrase-list">${c.phrases.slice(0,3).map(p=>`<span>${escape(p)}</span>`).join('')}</div><div class="modal-actions"><button class="button primary" data-listen="save-word" ${saved?'disabled':''}>${saved?'✓ In your vocabulary':'＋ Add to vocabulary'}</button></div><p class="notice">${saved?'This word is already in your collection.':'Saves this sentence, meaning, pronunciation, and useful phrases together.'}</p>`:''}`;
  }
  saveWord(){if(!this.lookupCard||!this.lookupToken)return;this.onAddWord({word:this.lookupToken.word,card:this.lookupCard,sentence:this.lookupToken.sentence,lesson:this.lesson});this.renderLookup();}
  closeLookup(){this.wordEpoch++;this.lookupOpen=false;const dialog=document.querySelector('#listening-word-dialog');if(dialog?.open)dialog.close();}
 }
 root.DaylightListening={Player:ListeningPlayer,transcriptParts,normalize,time,sentenceAudio,cueAt,StudyClock,studyTime,validateProgress};
})(globalThis);
