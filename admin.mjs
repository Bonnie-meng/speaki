import {createAccountStore} from './accounts.mjs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
const phone=process.argv[2];
if(!phone){console.error('Usage: npm run admin -- +8613800000000\nRegister your account in Daylight first. Run this command on the server only.');process.exit(1);}
const store=createAccountStore({filename:process.env.DATABASE_PATH||path.join(path.dirname(fileURLToPath(import.meta.url)),'.data/daylight.sqlite')});
try{store.promote(phone);console.log('Administrator access granted. Sign in again or refresh your account.');}catch(error){console.error(error.message);process.exitCode=1;}finally{store.close();}
