import {accountError,SESSION_MS} from './accounts.mjs';
export function createAccountHttp(store,{publicOrigin=process.env.PUBLIC_ORIGIN,production=process.env.NODE_ENV==='production',trustProxy=process.env.TRUST_PROXY==='1'}={}){
 let origin=null;if(publicOrigin){origin=new URL(publicOrigin).origin;if(production&&!origin.startsWith('https://'))throw Error('PUBLIC_ORIGIN must use HTTPS in production.');}
 if(production&&!origin)throw Error('Set PUBLIC_ORIGIN before starting the public service.');
 const secure=production||origin?.startsWith('https://');
 const cookieName=secure?'__Host-daylight_session':'daylight_session';
 const cookie=(token,age=SESSION_MS/1000)=>`${cookieName}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${age}${secure?'; Secure':''}`;
 const token=req=>(req.headers.cookie||'').split(';').map(c=>c.trim()).find(c=>c.startsWith(cookieName+'='))?.slice(cookieName.length+1)||'';
 const json=(res,status,body)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(body));};
 function checkOrigin(req){
  const host=req.headers.host||'';let requested;try{requested=new URL('http://'+host);}catch{throw accountError('Invalid request host.',403);}
  const loopback=['127.0.0.1','localhost','[::1]'].includes(requested.hostname);
  if(origin?host!==new URL(origin).host:!loopback)throw accountError('Use the configured Daylight website.',403);
  if(req.headers.origin&&req.headers.origin!==(origin||'http://'+host))throw accountError('Use this action from your Daylight page.',403);
  if(['cross-site','same-site'].includes(req.headers['sec-fetch-site']))throw accountError('Use this action from your Daylight page.',403);
 }
 function ip(req){const direct=req.socket.remoteAddress||'unknown';const local=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(direct);return trustProxy&&local&&req.headers['x-forwarded-for']?String(req.headers['x-forwarded-for']).split(',')[0].trim().slice(0,100):direct;}
 async function body(req,max=8192){if(!req.headers['content-type']?.startsWith('application/json'))throw accountError('Expected a JSON request.',415);const chunks=[];let size=0;for await(const chunk of req){size+=chunk.length;if(size>max)throw accountError('Request is too large.',413);chunks.push(chunk);}try{return JSON.parse(Buffer.concat(chunks).toString());}catch{throw accountError('Could not read this request.');}}
 function requireUser(req){const session=store.authenticate(token(req));if(!session)throw accountError('Your session has expired. Please sign in again.',401,'SESSION_EXPIRED');if(req.headers['x-daylight-account']&&req.headers['x-daylight-account']!==session.user.id)throw accountError('Account changed. Please sign in again.',403,'ACCOUNT_CHANGED');return session.user;}
 function signed(res,session){res.setHeader('Set-Cookie',cookie(session.token));return json(res,200,{user:session.user,expiresAt:session.expiresAt});}
 let activeAuth=0;
 async function expensive(run){if(activeAuth>=2)throw accountError('Please wait a moment and try again.',429);activeAuth++;try{return await run();}finally{activeAuth--;}}
 return {checkOrigin,requireUser,ip,
  async handle(req,res,url){
   const pathname=url.pathname;
   if(!pathname.startsWith('/api/auth/')&&!pathname.startsWith('/api/account/')&&!pathname.startsWith('/api/admin/'))return false;
   checkOrigin(req);
   if(pathname==='/api/auth/me'&&req.method==='GET'){const session=store.authenticate(token(req));json(res,200,{user:session?.user||null,expiresAt:session?.expiresAt||null});return true;}
   if(['/api/auth/register','/api/auth/login'].includes(pathname)&&req.method==='POST'){
    store.rate('auth-ip:'+ip(req),35,15*60*1000);if(pathname.endsWith('/register'))store.rate('signup-ip:'+ip(req),8,60*60*1000);
    const input=await body(req);const session=await expensive(()=>pathname.endsWith('/register')?store.register(input.phone,input.password):store.login(input.phone,input.password));signed(res,session);return true;
   }
   if(pathname==='/api/auth/logout'&&req.method==='POST'){await body(req);const current=store.authenticate(token(req));if(current&&req.headers['x-daylight-account']&&current.user.id!==req.headers['x-daylight-account'])throw accountError('Account changed. Please sign in again.',403,'ACCOUNT_CHANGED');store.logout(token(req));res.setHeader('Set-Cookie',cookie('',0));json(res,200,{ok:true});return true;}
   const user=requireUser(req);
   if(pathname==='/api/auth/password'&&req.method==='POST'){const input=await body(req);store.rate('password:'+user.id,8,15*60*1000);signed(res,await expensive(()=>store.changePassword(user.id,input.currentPassword,input.newPassword)));return true;}
   if(user.mustChangePassword)throw accountError('Set a new password to continue.',428,'PASSWORD_CHANGE_REQUIRED');
   if(pathname==='/api/account/state'&&req.method==='GET'){json(res,200,{...store.readState(user.id),userId:user.id});return true;}
   if(pathname==='/api/account/state'&&req.method==='PUT'){store.rate('state-write:'+user.id,90,60000);const input=await body(req,5*1024*1024+16384);if(input.accountId!==user.id)throw accountError('Account changed. Please sign in again.',403,'ACCOUNT_CHANGED');try{globalThis.DaylightState.validate(input.data);}catch{throw accountError('This learning data is invalid. Export a backup and try again.');}json(res,200,store.writeState(user.id,input.data,input.revision));return true;}
   if(pathname==='/api/admin/users'&&req.method==='GET'){json(res,200,{users:store.listUsers(user)});return true;}
   const reset=/^\/api\/admin\/users\/([a-f0-9-]{36})\/reset-password$/.exec(pathname);
   if(reset&&req.method==='POST'){if(user.role!=='admin')throw accountError('Administrator access required.',403);await body(req);store.rate('admin-reset:'+user.id,20,60*60*1000);json(res,200,await expensive(()=>store.resetPassword(user,reset[1])));return true;}
   json(res,404,{error:'Not found.'});return true;
  }
 };
}
