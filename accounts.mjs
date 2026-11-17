import Database from 'better-sqlite3';
import {randomBytes,randomUUID,scrypt as scryptCallback,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import {mkdirSync,chmodSync} from 'node:fs';
import path from 'node:path';
import './listening.js';
import './learning-state.js';
const scrypt=promisify(scryptCallback);
export const SESSION_MS=7*24*60*60*1000;
export const accountError=(message,status=400,code)=>Object.assign(new Error(message),{status,code});
const digest=text=>createHash('sha256').update(text).digest('hex');
export function normalizePhone(value){
 if(typeof value!=='string')throw accountError('Enter an 11-digit mainland China mobile number.');
 const number=value.trim().replace(/[\s-]/g,'').replace(/^(?:\+86|0086)/,'');
 if(!/^1[3-9]\d{9}$/.test(number))throw accountError('Enter an 11-digit mainland China mobile number (+86).');
 return '+86'+number;
}
export function validatePassword(password){if(typeof password!=='string'||password.length<10||password.length>128)throw accountError('Use a password with 10–128 characters.');return password;}
export async function hashPassword(password){
 validatePassword(password);const salt=randomBytes(16).toString('hex');const key=await scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
 return `scrypt$131072$8$1$${salt}$${key.toString('hex')}`;
}
export async function verifyPassword(password,encoded){
 if(typeof password!=='string'||password.length>128)return false;
 const match=/^scrypt\$131072\$8\$1\$([a-f0-9]{32})\$([a-f0-9]{128})$/.exec(encoded||'');
 const salt=match?.[1]||'00000000000000000000000000000000';
 const key=await scrypt(password,salt,64,{N:131072,r:8,p:1,maxmem:256*1024*1024});
 return Boolean(match)&&timingSafeEqual(key,Buffer.from(match[2],'hex'));
}
const publicUser=row=>row?{id:row.id,phone:row.phone,role:row.role,createdAt:row.created_at,lastLoginAt:row.last_login_at,mustChangePassword:Boolean(row.must_change_password)}:null;
export function createAccountStore({filename=path.resolve('.data/daylight.sqlite'),now=()=>Date.now()}={}){
 if(filename!==':memory:'){mkdirSync(path.dirname(filename),{recursive:true,mode:0o700});}
 const db=new Database(filename);if(filename!==':memory:')chmodSync(filename,0o600);
 db.pragma('journal_mode = WAL');db.pragma('foreign_keys = ON');db.pragma('busy_timeout = 5000');
 db.exec(`CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, phone TEXT UNIQUE NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user','admin')),
 created_at INTEGER NOT NULL, last_login_at INTEGER, password_changed_at INTEGER NOT NULL,
 must_change_password INTEGER NOT NULL DEFAULT 0 CHECK(must_change_password IN (0,1)));
 CREATE TABLE IF NOT EXISTS sessions (token_hash TEXT PRIMARY KEY,user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
 CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
 CREATE TABLE IF NOT EXISTS learning_states (user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,data TEXT NOT NULL,revision INTEGER NOT NULL,updated_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS rate_limits (key TEXT PRIMARY KEY,count INTEGER NOT NULL,reset_at INTEGER NOT NULL);
 CREATE TABLE IF NOT EXISTS admin_events (id INTEGER PRIMARY KEY,actor_id TEXT NOT NULL REFERENCES users(id),target_id TEXT NOT NULL REFERENCES users(id),action TEXT NOT NULL,created_at INTEGER NOT NULL);`);
 const getUser=id=>publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id));
 const session=id=>{const token=randomBytes(32).toString('base64url'),expiresAt=now()+SESSION_MS;db.prepare('DELETE FROM sessions WHERE expires_at<=?').run(now());db.prepare('INSERT INTO sessions VALUES(?,?,?,?)').run(digest(token),id,now(),expiresAt);return {token,expiresAt,user:getUser(id)};};
 const rate=(key,limit,windowMs)=>db.transaction(()=>{const safeKey=digest(key),time=now();db.prepare('DELETE FROM rate_limits WHERE reset_at<=?').run(time);const row=db.prepare('SELECT * FROM rate_limits WHERE key=?').get(safeKey);if(row&&row.count>=limit)throw accountError('Too many attempts. Please try again later.',429);db.prepare('INSERT INTO rate_limits VALUES(?,1,?) ON CONFLICT(key) DO UPDATE SET count=count+1').run(safeKey,time+windowMs);})();
 return {
  close:()=>db.close(),now,getUser,
  async register(phone,password){phone=normalizePhone(phone);validatePassword(password);const hash=await hashPassword(password),id=randomUUID();try{db.prepare('INSERT INTO users(id,phone,password_hash,created_at,password_changed_at) VALUES(?,?,?,?,?)').run(id,phone,hash,now(),now());}catch(error){if(error.code==='SQLITE_CONSTRAINT_UNIQUE')throw accountError('This phone number is already registered. Please sign in.',409);throw error;}return session(id);},
  async login(phone,password){phone=normalizePhone(phone);rate('login:'+phone,12,15*60*1000);const row=db.prepare('SELECT * FROM users WHERE phone=?').get(phone);if(!await verifyPassword(password,row?.password_hash))throw accountError('Phone number or password is incorrect.',401,'INVALID_CREDENTIALS');db.prepare('DELETE FROM rate_limits WHERE key=?').run(digest('login:'+phone));db.prepare('UPDATE users SET last_login_at=? WHERE id=?').run(now(),row.id);return session(row.id);},
  authenticate(token){if(typeof token!=='string'||!/^[\w-]{43}$/.test(token))return null;const row=db.prepare('SELECT user_id,expires_at FROM sessions WHERE token_hash=? AND expires_at>?').get(digest(token),now());return row?{user:getUser(row.user_id),expiresAt:row.expires_at}:null;},
  logout(token){db.prepare('DELETE FROM sessions WHERE token_hash=?').run(digest(token||''));},
  rate,
  readState(userId){const row=db.prepare('SELECT data,revision,updated_at FROM learning_states WHERE user_id=?').get(userId);return row?{data:JSON.parse(row.data),revision:row.revision,updatedAt:row.updated_at}:{data:null,revision:0,updatedAt:null};},
  writeState(userId,data,revision){globalThis.DaylightState.validate(data);if(!Number.isSafeInteger(revision)||revision<0)throw accountError('Invalid data revision.');const text=JSON.stringify(data);if(Buffer.byteLength(text)>5*1024*1024)throw accountError('Your learning data is too large.',413);return db.transaction(()=>{const current=db.prepare('SELECT revision FROM learning_states WHERE user_id=?').get(userId)?.revision||0;if(current!==revision)throw accountError('Your data changed in another tab. Keep a backup and reload the latest version.',409,'STATE_CONFLICT');const next=current+1;db.prepare('INSERT INTO learning_states VALUES(?,?,?,?) ON CONFLICT(user_id) DO UPDATE SET data=excluded.data,revision=excluded.revision,updated_at=excluded.updated_at').run(userId,text,next,now());return {revision:next,updatedAt:now()};})();},
  listUsers(actor){if(actor.role!=='admin')throw accountError('Administrator access required.',403);return db.prepare('SELECT u.*,s.updated_at AS data_updated_at FROM users u LEFT JOIN learning_states s ON s.user_id=u.id ORDER BY u.created_at DESC').all().map(row=>({...publicUser(row),dataUpdatedAt:row.data_updated_at}));},
  promote(phone){phone=normalizePhone(phone);const row=db.prepare('SELECT id FROM users WHERE phone=?').get(phone);if(!row)throw accountError('Register this phone number first.');db.prepare("UPDATE users SET role='admin' WHERE id=?").run(row.id);return getUser(row.id);},
  async resetPassword(actor,targetId){if(actor.role!=='admin')throw accountError('Administrator access required.',403);if(actor.id===targetId)throw accountError('Use Change password for your own account.');const target=getUser(targetId);if(!target)throw accountError('User not found.',404);const temporaryPassword=randomBytes(15).toString('base64url'),hash=await hashPassword(temporaryPassword);db.transaction(()=>{db.prepare('UPDATE users SET password_hash=?,password_changed_at=?,must_change_password=1 WHERE id=?').run(hash,now(),targetId);db.prepare('DELETE FROM sessions WHERE user_id=?').run(targetId);db.prepare('INSERT INTO admin_events(actor_id,target_id,action,created_at) VALUES(?,?,?,?)').run(actor.id,targetId,'password_reset',now());})();return {temporaryPassword,user:getUser(targetId)};},
  async changePassword(id,oldPassword,newPassword){validatePassword(newPassword);if(oldPassword===newPassword)throw accountError('Choose a different new password.');const row=db.prepare('SELECT * FROM users WHERE id=?').get(id);if(!row||!await verifyPassword(oldPassword,row.password_hash))throw accountError('Current password is incorrect.',400);const hash=await hashPassword(newPassword);db.transaction(()=>{db.prepare('UPDATE users SET password_hash=?,password_changed_at=?,must_change_password=0 WHERE id=?').run(hash,now(),id);db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);})();return session(id);}
 };
}
