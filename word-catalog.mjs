import {readFileSync} from 'node:fs';
const data=JSON.parse(readFileSync(new URL('./data/cefrj-a1-b2.json',import.meta.url),'utf8'));
export const catalogue=Object.freeze(data);
export const catalogueById=new Map(data.entries.map(entry=>[entry.id,Object.freeze(entry)]));
export function libraryEntry(id){return typeof id==='string'?catalogueById.get(id):undefined;}
export function libraryPrompt(entry){
 return {word:entry.word,level:entry.level,partOfSpeech:entry.pos,source:`Public CEFR-J ${entry.level} learning card. Target part of speech: ${entry.pos}. Teach the common meaning for this part of speech, not another part of speech. Use simple ${entry.level} English for definitions and examples. Give original examples and natural common chunks. The pos field MUST be exactly "${entry.pos}". ${entry.aliases?.length?'Alternative spellings: '+entry.aliases.join(', ')+'. ':''}${entry.topics?.length?'Topic hints: '+entry.topics.join(', ')+'.':''}`};
}
