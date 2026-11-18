import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {catalogue,libraryEntry} from './word-catalog.mjs';
import {createAccountStore} from './accounts.mjs';
import {createAppServer} from './server.mjs';
import './library-progress.js';
import './word-library.js';
const P=globalThis.SpeakiLibraryProgress;
const word=catalogue.entries.find(e=>e.word==='ability'&&e.pos==='noun');
const card=pos=>({ipa:'/əˈbɪləti/',pos,category:'Everyday',register:'Neutral',meaning:'The skill or power to do something.',zh:'能力',usage:'Common in speech and writing.',example:'She has the ability to explain things clearly.',prompt:'Describe an ability you want to improve.',otherMeaning:'',phrases:['the ability to learn','natural ability']});
const emptyState=()=>({version:1,words:[],activity:{},drafts:{},focus:{day:'2026-11-18',seconds:0},listening:{}});
async function serverTest(generate,run){
 const store=createAccountStore({filename:':memory:'}),server=createAppServer({accountStore:store,generate});await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const request=(route,{session,body,method='GET',headers={}}={})=>fetch(base+route,{method,headers:{...(session?{Cookie:session}:{}),...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},...(body!==undefined?{body:JSON.stringify(body)}:{})});
 const register=async phone=>{const res=await request('/api/auth/register',{method:'POST',body:{phone,password:'TestA123'}});assert.equal(res.status,200);return {session:res.headers.get('set-cookie').split(';')[0],user:(await res.json()).user};};
 try{await run({request,register,store});}finally{await new Promise(r=>server.close(r));}
}
test('official 1.6 catalogue preserves all 7801 part-of-speech entries and published level totals',()=>{
 assert.equal(catalogue.source.version,'1.6');assert.equal(catalogue.entries.length,7801);assert.match(catalogue.source.sha256,/^[a-f0-9]{64}$/);
 assert.deepEqual(catalogue.levels,{A1:1166,A2:1411,B1:2445,B2:2779});assert.equal(new Set(catalogue.entries.map(e=>e.id)).size,7801);
 for(const entry of catalogue.entries){assert.ok(P.idPattern.test(entry.id));assert.ok(P.levels.includes(entry.level));assert.equal(libraryEntry(entry.id),entry);}
 const variants=catalogue.entries.find(e=>e.word==='a.m.');assert.ok(variants.aliases.includes('AM'));
 const address=catalogue.entries.filter(e=>e.word==='address');assert.ok(address.some(e=>e.pos==='noun'));assert.ok(address.some(e=>e.pos==='verb'));assert.ok(new Set(address.map(e=>e.level)).size>1);
});
test('private progress validates dates and schedules calendar-based reviews without mutating previous progress',()=>{
 const previous={status:'learning',reviews:2,due:'2026-01-31',startedAt:'2026-01-01',updatedAt:'2026-01-28'};const next=P.rate(previous,'know',new Date('2026-01-31T12:00:00'));
 assert.equal(next.due,'2026-02-03');assert.equal(next.reviews,3);assert.equal(next.startedAt,'2026-01-01');assert.equal(previous.reviews,2);
 assert.equal(P.rate(next,'use',new Date('2026-02-03T12:00:00')).status,'mastered');assert.equal(P.due({[word.id]:next},word.id,new Date('2026-02-03T12:00:00')),true);
 P.validate(undefined);P.validate({level:'A2',progress:{[word.id]:next}});
 for(const data of [{level:'C1',progress:{}},{level:'A1',progress:{'__bad_id':next}},{level:'A1',progress:{[word.id]:{...next,due:'2026-02-31'}}},{level:'A1',progress:{[word.id]:{...next,reviews:-1}}}])assert.throws(()=>P.validate(data));
});
test('browsing makes no AI calls; one public card is deduplicated across accounts without sharing private progress',async()=>{
 let calls=0;await serverTest(async input=>{calls++;assert.equal(input.word,word.word);assert.equal(input.partOfSpeech,word.pos);assert.equal(input.level,word.level);await new Promise(r=>setTimeout(r,20));return card(input.partOfSpeech);},async({request,register})=>{
  assert.equal((await request('/api/word-library')).status,401);const a=await register('13800000001'),b=await register('13800000002');
  const list=await (await request('/api/word-library',{session:a.session})).json();assert.equal(list.entries.length,7801);assert.equal(list.progress,undefined);assert.equal(list.user,undefined);
  assert.equal((await (await request('/api/word-library/'+word.id,{session:a.session})).json()).card,null);assert.equal(calls,0);
  assert.equal((await request('/api/word-library/'+word.id,{session:a.session,method:'POST',body:{source:'Private notes must never enter a shared card.'}})).status,400);assert.equal(calls,0);
  const results=await Promise.all([a,b].map(user=>request('/api/word-library/'+word.id,{session:user.session,method:'POST',body:{}})));assert.ok(results.every(r=>r.status===200));assert.deepEqual((await results[0].json()).card,(await results[1].json()).card);assert.equal(calls,1);
  const cached=await (await request('/api/word-library/'+word.id,{session:b.session})).json();assert.equal(cached.cached,true);assert.equal(calls,1);
  assert.equal((await (await request('/api/account/state',{session:a.session})).json()).data,null);
  const data=emptyState();data.library={level:'A2',progress:{[word.id]:P.rate(undefined,'use',new Date('2026-11-18T12:00:00'))}};
  const saved=await request('/api/account/state',{session:a.session,method:'PUT',body:{accountId:a.user.id,revision:0,data}});assert.equal(saved.status,200);
  assert.equal((await (await request('/api/account/state',{session:a.session})).json()).data.library.progress[word.id].status,'mastered');assert.equal((await (await request('/api/account/state',{session:b.session})).json()).data,null);
  const cross=await request('/api/account/state',{session:b.session,method:'PUT',body:{accountId:a.user.id,revision:1,data}});assert.equal(cross.status,403);
  const unknown=structuredClone(data);unknown.library.progress['cefrj16-0000000000000000']=unknown.library.progress[word.id];assert.equal((await request('/api/account/state',{session:a.session,method:'PUT',body:{accountId:a.user.id,revision:1,data:unknown}})).status,400);
  data.library.progress[word.id].due='2026-02-31';assert.equal((await request('/api/account/state',{session:a.session,method:'PUT',body:{accountId:a.user.id,revision:1,data}})).status,400);
 });
});
test('invalid IDs and mismatched generated parts of speech never poison the shared cache',async()=>{
 let valid=false,calls=0;await serverTest(async input=>{calls++;return card(valid?input.partOfSpeech:'verb');},async({request,register})=>{
  const a=await register('13800000001');assert.equal((await request('/api/word-library/cefrj16-0000000000000000',{session:a.session,method:'POST',body:{}})).status,404);assert.equal(calls,0);
  assert.equal((await request('/api/word-library/'+word.id,{session:a.session,method:'POST',body:{}})).status,502);assert.equal((await (await request('/api/word-library/'+word.id,{session:a.session})).json()).card,null);
  valid=true;assert.equal((await request('/api/word-library/'+word.id,{session:a.session,method:'POST',body:{}})).status,200);assert.equal(calls,2);
 });
});
test('shared learning cards and private progress survive database reopen',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'speaki-library-')),filename=path.join(dir,'test.sqlite');let store;
 try{store=createAccountStore({filename});const a=await store.register('13800000001','TestA123');const data=emptyState();data.library={level:'A2',progress:{[word.id]:P.rate(undefined,'again')}};store.writeState(a.user.id,data,0);store.writeLibraryCard(word.id,card('noun'));store.close();store=createAccountStore({filename});assert.equal(store.readLibraryCard(word.id).pos,'noun');assert.equal(store.readState(a.user.id).data.library.progress[word.id].reviews,1);}finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('switching accounts discards late library responses before any new generation or private UI update',async()=>{
 const dialog={open:false,showModal(){this.open=true;},close(){this.open=false;}};globalThis.document={querySelector:()=>dialog};let owner='A',resolveFetch,requests=0,changes=0;
 globalThis.fetch=async()=>{requests++;return new Promise(resolve=>{resolveFetch=resolve;});};
 const library=new globalThis.SpeakiWordLibrary({getOwner:()=>owner,getData:()=>({level:'A2',progress:{}}),stopAudio:()=>{},onChange:()=>changes++,notify:()=>{}});library.catalog=catalogue;library.paintCard=()=>{};
 const loading=library.openCard(word.id);owner='B';library.reset();resolveFetch(Response.json({entry:word,card:null}));await loading;
 assert.equal(requests,1);assert.equal(changes,0);assert.equal(library.card,null);assert.equal(library.entry,null);assert.equal(library.level,null);assert.equal(library.stats('A2').studied,0);
});
