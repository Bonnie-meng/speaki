import test from 'node:test';
import http from 'node:http';
import assert from 'node:assert/strict';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createAccountStore,normalizePhone,SESSION_MS} from './accounts.mjs';
import {createAppServer} from './server.mjs';
const password='test-only-password-A1';
const state=word=>({version:1,words:[{id:'example',word,category:'Everyday',status:'new',phrases:[],due:'2026-11-17',reviews:0,ipa:'',pos:'noun',register:'Neutral',meaning:'A private test word',zh:'',example:'',source:'Private test',createdAt:'2026-11-17'}],activity:{},drafts:{meeting:'Private speaking notes'},focus:{day:'2026-11-17',seconds:0},listening:{}});
const cookie=response=>response.headers.get('set-cookie').split(';')[0];
async function setup(run,options={}){
 const store=createAccountStore({filename:':memory:',...options}),server=createAppServer({accountStore:store,generate:async()=>{throw Error('Should not call AI');}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 const request=(route,{method='GET',body,session,headers={}}={})=>fetch(base+route,{method,headers:{...(body?{'Content-Type':'application/json'}:{}),...(session?{Cookie:session}:{}),...headers},...(body?{body:JSON.stringify(body)}:{})});
 try{await run({store,request});}finally{await new Promise(resolve=>server.close(resolve));}
}
test('mainland phone identifiers are normalized and unsupported numbers rejected',()=>{
 assert.equal(normalizePhone('13800000001'),'+8613800000001');assert.equal(normalizePhone('+86 138-0000-0001'),'+8613800000001');
 for(const phone of ['+12125551234','+85212345678','12800000001','1380000000',null,"13800000001' OR 1=1"])assert.throws(()=>normalizePhone(phone));
});
test('registration, login and logout use expiring HttpOnly sessions without exposing password material',async()=>{
 let now=1000000;await setup(async({request})=>{
  const registration=await request('/api/auth/register',{method:'POST',body:{phone:'13800000001',password,role:'admin'}});assert.equal(registration.status,200);const session=cookie(registration),body=await registration.json();assert.equal(body.user.role,'user');assert.equal(body.expiresAt,now+SESSION_MS);assert.match(registration.headers.get('set-cookie'),/HttpOnly/);assert.match(registration.headers.get('set-cookie'),/SameSite=Lax/);assert.match(registration.headers.get('set-cookie'),/Max-Age=604800/);assert.equal(body.user.password,undefined);assert.equal(body.user.password_hash,undefined);
  assert.equal((await request('/api/auth/register',{method:'POST',body:{phone:'13800000001',password}})).status,409);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{phone:'13800000001',password:'wrong-password'}})).status,401);
  assert.equal((await request('/api/enrich',{method:'POST',body:{word:'test',source:''}})).status,401);
  now+=SESSION_MS-1;assert.ok((await (await request('/api/auth/me',{session})).json()).user);now++;assert.equal((await (await request('/api/auth/me',{session})).json()).user,null);
  const login=await request('/api/auth/login',{method:'POST',body:{phone:'13800000001',password}});const next=cookie(login);assert.equal(login.status,200);await request('/api/auth/logout',{method:'POST',body:{},session:next});assert.equal((await (await request('/api/auth/me',{session:next})).json()).user,null);
 },{now:()=>now});
});
test('learning data belongs only to the signed-in user and rejects stale or cross-account writes',async()=>{
 await setup(async({request})=>{
  const a=await request('/api/auth/register',{method:'POST',body:{phone:'13800000001',password}}),aCookie=cookie(a),aId=(await a.json()).user.id;
  const b=await request('/api/auth/register',{method:'POST',body:{phone:'13800000002',password}}),bCookie=cookie(b),bId=(await b.json()).user.id;
  assert.equal((await request('/api/account/state',{method:'PUT',session:aCookie,body:{accountId:aId,revision:0,data:state('private-A')}})).status,200);
  assert.equal((await (await request('/api/account/state',{session:bCookie})).json()).data,null);
  assert.equal((await request('/api/account/state',{method:'PUT',session:bCookie,body:{accountId:aId,revision:0,data:state('attack')}})).status,403);
  assert.equal((await request('/api/account/state',{session:bCookie,headers:{'X-Daylight-Account':aId}})).status,403);
  assert.equal((await request('/api/account/state',{method:'PUT',session:aCookie,body:{accountId:aId,revision:0,data:state('stale')}})).status,409);
  assert.equal((await request('/api/account/state',{method:'PUT',session:aCookie,body:{accountId:aId,revision:1,data:{version:1}}})).status,400);
  const saved=await (await request('/api/account/state',{session:aCookie})).json();assert.equal(saved.data.words[0].word,'private-A');assert.equal(saved.data.drafts.meeting,'Private speaking notes');assert.equal(saved.revision,1);assert.equal(saved.userId,aId);assert.notEqual(aId,bId);
 });
});
test('admin reset is restricted, revokes old sessions and requires a new password before learning access',async()=>{
 await setup(async({store,request})=>{
  const adminResponse=await request('/api/auth/register',{method:'POST',body:{phone:'13800000001',password}}),adminCookie=cookie(adminResponse);
  const userResponse=await request('/api/auth/register',{method:'POST',body:{phone:'13800000002',password}}),userCookie=cookie(userResponse),user=(await userResponse.json()).user;
  assert.equal((await request('/api/admin/users',{session:userCookie})).status,403);store.promote('13800000001');
  const users=await (await request('/api/admin/users',{session:adminCookie})).json();assert.equal(users.users.length,2);assert.ok(users.users.every(u=>!('password_hash' in u)));
  const resetPath='/api/admin/users/'+user.id+'/reset-password';assert.equal((await request(resetPath,{method:'POST',session:userCookie,body:{}})).status,403);
  const reset=await (await request(resetPath,{method:'POST',session:adminCookie,body:{}})).json();assert.ok(reset.temporaryPassword);assert.equal((await (await request('/api/auth/me',{session:userCookie})).json()).user,null);
  const temporary=await request('/api/auth/login',{method:'POST',body:{phone:'13800000002',password:reset.temporaryPassword}}),temporaryCookie=cookie(temporary);assert.equal((await temporary.json()).user.mustChangePassword,true);
  assert.equal((await request('/api/account/state',{session:temporaryCookie})).status,428);
  const changed=await request('/api/auth/password',{method:'POST',session:temporaryCookie,body:{currentPassword:reset.temporaryPassword,newPassword:'new-test-password-B2'}});assert.equal(changed.status,200);assert.equal((await changed.json()).user.mustChangePassword,false);assert.equal((await request('/api/account/state',{session:cookie(changed)})).status,200);
  assert.equal((await request('/api/auth/login',{method:'POST',body:{phone:'13800000002',password:reset.temporaryPassword}})).status,401);
 });
});
test('cross-origin requests, database files and private assistant enrichments stay inaccessible',async()=>{
 await setup(async({request})=>{
  assert.equal((await request('/api/auth/register',{method:'POST',headers:{Origin:'https://unrelated.example'},body:{phone:'13800000001',password}})).status,403);
  for(const route of ['/.data/daylight.sqlite','/.env.local','/accounts.mjs','/enrichments.json'])assert.equal((await request(route)).status,404);
 });
});
test('account and learning records survive reopening the database; hashes never contain the password',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'daylight-account-test-'));const filename=path.join(dir,'accounts.sqlite');let store;
 try{store=createAccountStore({filename});const session=await store.register('13800000001',password);store.writeState(session.user.id,state('persisted'),0);store.close();store=createAccountStore({filename});assert.equal(store.authenticate(session.token).user.id,session.user.id);assert.equal(store.readState(session.user.id).data.words[0].word,'persisted');const login=await store.login('13800000001',password);assert.ok(login.token);}
 finally{store?.close();await rm(dir,{recursive:true,force:true});}
});
test('attempt limits are enforced without an SMS or mail service',()=>{const store=createAccountStore({filename:':memory:'});try{store.rate('test-ip',2,60000);store.rate('test-ip',2,60000);assert.throws(()=>store.rate('test-ip',2,60000),error=>error.status===429);}finally{store.close();}});

test('public HTTPS configuration sets Secure cookies and accepts only its exact website origin',async()=>{
 const store=createAccountStore({filename:':memory:'}),server=createAppServer({accountStore:store,accountOptions:{production:true,publicOrigin:'https://speaki.cn'}});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 try{const response=await new Promise((resolve,reject)=>{const req=http.request(base+'/api/auth/register',{method:'POST',headers:{Host:'speaki.cn',Origin:'https://speaki.cn','Content-Type':'application/json'}},res=>{res.resume();res.on('end',()=>resolve({status:res.statusCode,cookie:res.headers['set-cookie']?.[0]}));});req.on('error',reject);req.end(JSON.stringify({phone:'13800000001',password}));});assert.equal(response.status,200);assert.match(response.cookie,/; Secure/);
 assert.equal((await fetch(base+'/api/auth/me',{headers:{Host:'speaki.cn',Origin:'https://another.example'}})).status,403);assert.equal((await fetch(base+'/api/auth/me')).status,403);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
