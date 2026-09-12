import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import {LocalAssistantRegistry} from '../src/lib/workbench/ai/registry';
import {BackboardMemory} from '../src/lib/workbench/ai/backboard';
async function main(){const dir=await mkdtemp(join(tmpdir(),'gmh-memory-'));const registry=new LocalAssistantRegistry(dir);const memory=new BackboardMemory(registry);const user='synthetic-smoke';try{
 await memory.mutate(user,{operation:'save',content:'Synthetic practice note: explain tradeoffs clearly.',confirmed:true,requestId:randomUUID()});
 let notes=await memory.list(user);if(notes.length!==1)throw new Error('Save mismatch');
 if((await memory.list('other-synthetic-user')).length)throw new Error('Ownership mismatch');
 await memory.mutate(user,{operation:'edit',id:notes[0].id,content:'Synthetic revised note: explain testing tradeoffs.',confirmed:true});
 notes=await memory.list(user);if(notes[0]?.content!=='Synthetic revised note: explain testing tradeoffs.')throw new Error('Edit mismatch');
 await memory.mutate(user,{operation:'delete',id:notes[0].id});if((await memory.list(user)).length)throw new Error('Delete mismatch');
 await memory.mutate(user,{operation:'save',content:'Synthetic disposable reset note.',confirmed:true,requestId:randomUUID()});
 await memory.mutate(user,{operation:'reset',confirmed:true});if((await memory.list(user)).length)throw new Error('Reset mismatch');
 console.log(JSON.stringify({passed:true,save:true,edit:true,delete:true,reset:true,userIsolation:true}));
 }finally{const id=await registry.get(user);if(id){const r=await fetch('https://app.backboard.io/api/assistants/'+encodeURIComponent(id),{method:'DELETE',headers:{'X-API-Key':process.env.BACKBOARD_API_KEY!},signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error('Synthetic assistant cleanup failed');}await rm(dir,{recursive:true,force:true});}}
main().catch(()=>{console.error('Memory smoke test failed; no full verification claimed.');process.exitCode=1;});
