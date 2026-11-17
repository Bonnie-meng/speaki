import test from 'node:test';
import assert from 'node:assert/strict';
import './speech.js';
const {chooseVoice,selectRecording,readyVoice}=globalThis.DaylightSpeech;
test('normal US voice wins over the first system voice and novelty effects',()=>{
 const voice=chooseVoice([{name:'Albert',lang:'en-US',localService:true},{name:'Whisper',lang:'en-US'},{name:'Zarvox',lang:'en-US'},{name:'Samantha',lang:'en-US'}]);
 assert.equal(voice.name,'Samantha');
 assert.equal(chooseVoice([{name:'Albert',lang:'en-US'},{name:'Boing',lang:'en-US'}]),null);
 assert.equal(chooseVoice([{name:'Samantha',lang:'zh-CN'}]),null);
 assert.equal(chooseVoice([{name:'Alex',lang:'en-US'},{name:'Google US English',lang:'en-US'}]).name,'Google US English');
});
test('only verified US dictionary recordings are labelled American',()=>{
 const entries=[{phonetics:[{audio:'https://api.dictionaryapi.dev/media/pronunciations/en/word-uk.mp3'},{audio:'https://api.dictionaryapi.dev/media/pronunciations/en/treasure-us.mp3',sourceUrl:'https://commons.wikimedia.org/w/index.php?curid=1769790',license:{name:'BY-SA 3.0',url:'https://creativecommons.org/licenses/by-sa/3.0'}}]}];
 assert.match(selectRecording(entries).url,/treasure-us.mp3$/);
 assert.equal(selectRecording([{phonetics:[{audio:'https://unrelated.example/word-us.mp3'}]}]),null);
 assert.equal(selectRecording([{phonetics:[{audio:'https://api.dictionaryapi.dev/media/pronunciations/en/word-uk.mp3'}]}]),null);
});
test('voice selection waits for asynchronously loaded normal voices',async()=>{
 const synth=new EventTarget();let voices=[];synth.getVoices=()=>voices;
 const result=readyVoice(synth,100);
 voices=[{name:'Samantha',lang:'en-US'}];synth.dispatchEvent(new Event('voiceschanged'));
 assert.equal((await result).name,'Samantha');
 assert.equal(await readyVoice({getVoices:()=>[],addEventListener(){},removeEventListener(){}},5),null);
});
