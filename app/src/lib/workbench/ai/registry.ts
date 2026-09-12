import "server-only";
import {mkdir,readFile,writeFile,rename,rm,chmod} from "node:fs/promises";
import {join} from "node:path";
import {createHash,randomUUID} from "node:crypto";
import {WorkbenchError} from "../errors";
import {z} from "zod";
const mapping=z.object({assistantId:z.string().min(1).max(200)}).strict();
export class LocalAssistantRegistry {
  constructor(private directory=join(process.cwd(),".local","backboard")) {}
  private key(userId:string){return createHash("sha256").update(userId).digest("hex");}
  async get(userId:string):Promise<string|null> {
    try{return mapping.parse(JSON.parse(await readFile(join(this.directory,`${this.key(userId)}.json`),"utf8"))).assistantId;}
    catch(e){if((e as NodeJS.ErrnoException).code==="ENOENT")return null;throw new WorkbenchError("REGISTRY_INVALID","The local memory ownership registry could not be read. Restore it before using memory.",503);}
  }
  async set(userId:string,assistantId:string) {
    await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);
    const dest=join(this.directory,`${this.key(userId)}.json`),tmp=`${dest}.${randomUUID()}.tmp`;
    try {await writeFile(tmp,JSON.stringify(mapping.parse({assistantId})),{flag:"wx",mode:0o600});await rename(tmp,dest);}
    finally{await rm(tmp,{force:true});}
  }
  async locked<T>(userId:string,fn:()=>Promise<T>):Promise<T> {
    await mkdir(this.directory,{recursive:true,mode:0o700});await chmod(this.directory,0o700);
    const lock=join(this.directory,`${this.key(userId)}.lock`);
    try{await mkdir(lock,{mode:0o700});}catch(e){if((e as NodeJS.ErrnoException).code==="EEXIST")throw new WorkbenchError("MEMORY_BUSY","Another memory operation is in progress. Retry after it finishes. A lock left by a stopped server needs local recovery.",409);throw e;}
    try{return await fn();}finally{await rm(lock,{recursive:true,force:true});}
  }
}
