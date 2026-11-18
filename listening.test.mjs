import test from 'node:test';
import assert from 'node:assert/strict';
import './listening-library.js';
import './listening-recordings.js';
import './listening.js';
const {Player,transcriptParts,normalize,sentenceAudio,cueAt,StudyClock,validateProgress}=globalThis.DaylightListening;
function wav(seconds=1,rate=8000){
 const bytes=new Uint8Array(44+seconds*rate*2),v=new DataView(bytes.buffer);
 for(const [at,text] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']])for(let i=0;i<text.length;i++)bytes[at+i]=text.charCodeAt(i);
 v.setUint32(4,bytes.length-8,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,rate,true);v.setUint32(28,rate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,bytes.length-44,true);return new Blob([bytes],{type:'audio/wav'});
}
function setup(getClip=async()=>wav()){
 globalThis.document={querySelector:()=>null};const instances=[];
 globalThis.Audio=class{constructor(src){this.src=src;this.currentTime=0;this.duration=30;this.plays=0;this.pauses=0;instances.push(this);}async play(){this.plays++;}pause(){this.pauses++;}};
 const player=new Player({lessons:globalThis.DaylightListeningLibrary,getClip});player.libraryOpen=false;return {player,instances};
}
test('pause, resume, seeking and speed changes retain the same audio and current position',async()=>{
 let generated=0;const {player,instances}=setup(async()=>{generated++;return wav();});
 await player.play();const audio=instances[0];audio.onloadedmetadata();player.seek(7.5);player.pause();
 assert.equal(player.position,7.5);assert.equal(player.playing,false);
 player.setRate(.8);await player.play();assert.equal(audio.currentTime,7.5);assert.equal(audio.playbackRate,.8);assert.equal(audio.preservesPitch,true);assert.equal(generated,player.parts.length);assert.equal(instances.length,1);assert.equal(audio.plays,2);
 player.restart();assert.equal(audio.currentTime,0);player.destroy();
});
test('cancelling a pending load never starts playback when the audio arrives',async()=>{
 let resolve;const {player,instances}=setup(()=>resolve?Promise.resolve(wav()):new Promise(r=>{resolve=r;}));
 const playing=player.play();player.pause();resolve(wav());await playing;
 assert.equal(instances[0].plays,0);assert.equal(player.playing,false);player.destroy();
});
test('changing material discards late audio and hides the next transcript',async()=>{
 let resolve;const {player,instances}=setup(()=>resolve?Promise.resolve(wav()):new Promise(r=>{resolve=r;}));
 player.transcriptVisible=true;const playing=player.play();player.select(1);resolve(wav());await playing;
 assert.equal(instances.length,0);assert.equal(player.lesson.id,'everyday');assert.equal(player.position,0);assert.equal(player.transcriptVisible,false);
});
test('transcript words preserve original text, punctuation, contractions and sentence context',()=>{
 const text='I’ll follow up on Friday. It’s a ten-minute walk!';const parts=transcriptParts(text),tokens=parts.flat().filter(p=>p.word);
 assert.equal(parts.flat().map(p=>p.text).join(''),text);assert.equal(tokens.find(p=>p.text==='I’ll').word,"I'll");assert.equal(tokens.find(p=>p.word==='Friday').sentence,'I’ll follow up on Friday.');assert.ok(tokens.find(p=>p.word==='ten-minute'));
 assert.equal(normalize('I’ll'),normalize("I'll"));
});
test('transcript is hidden initially and AI audio is never labelled as an authentic regional accent',()=>{
 const {player}=setup();const html=player.view();assert.match(html,/id="listening-transcript"[^>]*hidden/);assert.match(html,/AI-generated audio/);assert.match(html,/accent not independently verified/);
});

test('sentence boundaries use real audio durations and preserve PCM data',async()=>{
 let i=0;const track=await sentenceAudio(['One.','Two.','Three.'],async()=>wav(++i));
 assert.deepEqual(track.cues,[{start:0,end:1},{start:1,end:3},{start:3,end:6}]);
 const bytes=await track.blob.arrayBuffer(),view=new DataView(bytes);assert.equal(view.getUint32(40,true),6*8000*2);assert.equal(bytes.byteLength,44+6*8000*2);
 for(const [position,index] of [[0,0],[.99,0],[1,1],[2.99,1],[3,2],[6,2]])assert.equal(cueAt(track.cues,position),index);
 await assert.rejects(()=>sentenceAudio(['Invalid'],async()=>new Blob(['broken'])));
});
test('speed options match the requested five values and reject other rates',()=>{
 const {player}=setup();const options=[...player.view().matchAll(/<option value="([^"]+)"/g)].map(m=>Number(m[1]));
 assert.deepEqual(options,[.5,.8,1,1.2,1.5]);for(const rate of options){player.setRate(rate);assert.equal(player.rate,rate);}player.setRate(.75);assert.equal(player.rate,1.5);
});
test('visible transcript follows cue changes and seeks without scrolling the page',()=>{
 const {player}=setup();let scrolls=0;const lines=[0,1,2].map(index=>({dataset:{listenSentence:String(index)},classList:{toggle(name,active){this.active=active;}},setAttribute(){},removeAttribute(){},getBoundingClientRect:()=>({top:100+index*100,height:50})}));
 const host={scrollTop:0,clientHeight:200,getBoundingClientRect:()=>({top:100}),querySelectorAll:()=>lines,querySelector:selector=>lines[Number(selector.match(/="(\d+)"/)[1])],scrollTo(){scrolls++;}};
 globalThis.document={querySelector:()=>host};player.cues=[{start:0,end:2},{start:2,end:5},{start:5,end:9}];
 player.syncTranscript();assert.equal(scrolls,0);player.transcriptVisible=true;player.position=3;player.syncTranscript();assert.equal(player.activeSentence,1);assert.equal(lines[1].classList.active,true);assert.equal(scrolls,1);
 player.syncTranscript();assert.equal(scrolls,1);player.position=6;player.syncTranscript();assert.equal(player.activeSentence,2);assert.equal(scrolls,2);player.position=0;player.syncTranscript();assert.equal(player.activeSentence,0);assert.equal(scrolls,3);
});

test('recorded lessons play original local audio without requesting AI speech and keep caption IDs unique',async()=>{
 const {player,instances}=setup(()=>{throw Error('Original recordings must never call TTS');});
 const index=player.lessons.findIndex(l=>l.id==='voa-bottom-line');player.select(index);await player.play();
 assert.equal(instances[0].src,'/assets/listening/voa-bottom-line.m4a');assert.equal(player.cues.length,player.parts.length);
 assert.equal(new Set(player.tokens.map(t=>t.id)).size,player.tokens.length);
 assert.equal(player.parts.flat().map(t=>t.text).join(' ').includes('undefined'),false);
 assert.equal(cueAt(player.cues,0),-1);assert.equal(cueAt(player.cues,43),11);
 player.pause();player.setRate(1.2);await player.play();assert.equal(instances.length,1);assert.equal(instances[0].playbackRate,1.2);player.destroy();
});
test('free sources retain attribution and external lessons remain original-site links',()=>{
 const {player}=setup();const recorded=player.lessons.filter(l=>l.source.kind==='recorded');assert.ok(recorded.length>=2);
 for(const lesson of recorded){assert.ok(lesson.source.credit);assert.ok(lesson.source.licenseUrl);let end=0;for(const cue of lesson.segments){assert.ok(cue.start>=end);assert.ok(cue.end>cue.start);assert.ok(cue.text.trim());end=cue.end;}assert.equal(lesson.script,lesson.segments.map(s=>s.text).join(' '));}
 assert.equal(globalThis.DaylightListeningExternal.length,4);assert.match(player.externalView(),/Speaki’s player controls/);assert.match(player.externalView(),/target="_blank" rel="noopener noreferrer"/);
});

test('library filters and ordering let users choose any matching lesson',()=>{
 const {player}=setup();player.libraryOpen=true;assert.match(player.view(),/Find your next listen/);
 player.levelFilter='A2';assert.ok(player.catalogue().length>=2);assert.ok(player.catalogue().every(({lesson})=>lesson.level==='A2'));
 player.sceneFilter='Travel & directions';assert.equal(player.catalogue().length,1);
 player.sourceFilter='recorded';assert.equal(player.catalogue().length,0);assert.match(player.view(),/No lessons match/);
 player.sourceFilter='all';player.sceneFilter='all';player.levelFilter='all';player.sort='level';const rank={A2:0,B1:1,B2:2},levels=player.catalogue().map(({lesson})=>rank[lesson.level]);assert.deepEqual(levels,[...levels].sort());
 player.select(player.lessons.findIndex(l=>l.level==='B2'));assert.equal(player.libraryOpen,false);assert.equal(player.lesson.level,'B2');
});
test('study clock counts wall time at slow and fast speeds, excluding pauses and stalls',()=>{
 let now=0;const clock=new StudyClock(()=>now);assert.equal(clock.sample(5),0);clock.start(0);
 now=10000;assert.equal(clock.sample(5,.5),10);now=15000;assert.equal(clock.sample(12.5,1.5),5);
 now=25000;assert.equal(clock.sample(12.5,1.5),0);now=27000;assert.equal(clock.stop(15.5,1.5),2);
 now=37000;assert.equal(clock.sample(15.5),0);clock.start(50);now=39000;assert.equal(clock.sample(52),2);
});
test('per-lesson listening history saves time and position, survives player recreation and excludes seeking',async()=>{
 const history={};let now=0;const {player,instances}=setup();player.getProgress=id=>history[id];player.onProgress=(id,value)=>history[id]={...value,seconds:(history[id]?.seconds||0)+value.seconds,updatedAt:'2026-11-17'};player.studyClock=new StudyClock(()=>now);
 await player.play();instances[0].onloadedmetadata();now=6000;instances[0].currentTime=6;instances[0].ontimeupdate();assert.equal(history.meeting.seconds,6);
 player.pause();now=16000;assert.equal(history.meeting.seconds,6);player.seek(20);assert.equal(history.meeting.seconds,6);assert.equal(history.meeting.position,20);
 await player.play();now=18000;instances[0].currentTime=22;player.pause();assert.equal(history.meeting.seconds,8);assert.equal(history.meeting.position,22);
 player.select(1);assert.equal(player.position,0);player.select(0);assert.equal(player.position,22);assert.equal(history.meeting.seconds,8);
 const restored=new Player({lessons:player.lessons,getClip:async()=>wav(),getProgress:id=>history[id]});assert.equal(restored.position,22);assert.match(restored.libraryView(),/0:08<small>studied/);validateProgress(history);
 for(const value of [null,[],{test:{seconds:-1,position:0,completed:false,updatedAt:''}},{test:{seconds:1,position:NaN,completed:false,updatedAt:''}}])assert.throws(()=>validateProgress(value));validateProgress(undefined);
});

test('ELLLO adds eight real recordings with source-backed speaker origins and matching subtitle tracks',()=>{
 const lessons=globalThis.DaylightListeningLibrary.filter(l=>l.source.provider==='ELLLO');assert.equal(lessons.length,8);
 const origins=new Set(lessons.flatMap(l=>l.source.countries));for(const country of ['United Kingdom','Australia','Canada','Ghana','Kenya'])assert.ok(origins.has(country));
 for(const lesson of lessons){assert.ok(lesson.source.mediaUrl.endsWith('.mp3'));assert.ok(lesson.source.speakerInfoUrl);assert.match(lesson.source.license,/non-commercial/);assert.ok(lesson.source.speakers.every(s=>lesson.source.countries.includes(s.country)));assert.equal(lesson.script,lesson.segments.map(s=>s.text).join(' '));assert.ok(lesson.durationSeconds>25);assert.ok(Math.abs(lesson.segments.at(-1).end-lesson.durationSeconds)<.02);}
 const {player}=setup();player.countryFilter='United Kingdom';assert.equal(player.catalogue().length,3);assert.ok(player.catalogue().every(({lesson})=>lesson.source.provider==='ELLLO'));player.countryFilter='Canada';assert.equal(player.catalogue().length,1);assert.ok(player.catalogue()[0].lesson.source.countries.includes('United States'));
 player.countryFilter='all';player.sourceFilter='recorded';assert.equal(player.catalogue().length,10);assert.match(player.libraryView(),/Human · ELLLO/);assert.match(player.libraryView(),/Filter listening by speaker origin/);
});
