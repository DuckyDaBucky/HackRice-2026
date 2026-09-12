import "server-only";
import {z} from "zod";
import {WorkbenchError} from "../errors";
import {LocalAssistantRegistry} from "./registry";
import {memorySchema,type Memory,type PracticeMemory,type memoryMutationSchema} from "./contracts";
const base="https://app.backboard.io/api";
const safeId=(id:string)=>encodeURIComponent(id);
export class BackboardMemory implements PracticeMemory {
  constructor(private registry=new LocalAssistantRegistry(),private transport:typeof fetch=fetch){}
  private async call(path:string,method="GET",body?:unknown) {
    if(!process.env.BACKBOARD_API_KEY)throw new WorkbenchError("BACKBOARD_MISSING_KEY","Backboard is not configured. Add BACKBOARD_API_KEY locally to enable memory.",503);
    let response:Response;
    try{response=await this.transport(`${base}${path}`,{method,headers:{"X-API-Key":process.env.BACKBOARD_API_KEY,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(20000),cache:"no-store"});}
    catch{throw new WorkbenchError("BACKBOARD_UNAVAILABLE",method==="GET"?"Backboard could not be reached. Try again.":"Backboard did not confirm this operation. Refresh saved notes before retrying; it may have completed.",503);}
    if(!response.ok)throw new WorkbenchError("BACKBOARD_FAILED",response.status===429?"Backboard rate limit reached. Retry later.":"Backboard rejected the request. Check its key, account access and service status.",response.status===429?429:502);
    if(response.status===204)return {};
    try{return await response.json() as unknown;}catch{throw new WorkbenchError("BACKBOARD_OUTPUT","Backboard returned an unreadable response. Refresh before retrying a write.",502);}
  }
  private async rows(assistant:string):Promise<(Memory&{metadata?:Record<string,unknown>|null})[]> {
    const result:(Memory&{metadata?:Record<string,unknown>|null})[]=[];
    for(let page=1;page<=100;page++){
      const data=await this.call(`/assistants/${safeId(assistant)}/memories?page=${page}&page_size=100`);
      const parsed=z.object({memories:z.array(memorySchema.extend({metadata:z.record(z.string(),z.unknown()).nullable().optional()})),total_count:z.number().optional()}).safeParse(data);
      if(!parsed.success)throw new WorkbenchError("BACKBOARD_OUTPUT","Backboard returned an unsupported memory response.",502);
      result.push(...parsed.data.memories);
      if(parsed.data.memories.length<100||(parsed.data.total_count!==undefined&&result.length>=parsed.data.total_count))return result;
    }
    throw new WorkbenchError("MEMORY_LIMIT","Too many notes to load safely. Manage the assistant in Backboard before retrying.",409);
  }
  async list(userId:string):Promise<Memory[]> {
    if(!process.env.BACKBOARD_API_KEY)throw new WorkbenchError("BACKBOARD_MISSING_KEY","Backboard is not configured. Add BACKBOARD_API_KEY locally.",503);
    const assistant=await this.registry.get(userId);
    return assistant?(await this.rows(assistant)).map(({id,content})=>({id,content})):[];
  }
  async search(userId:string,query:string):Promise<Memory[]> {
    if(!process.env.BACKBOARD_API_KEY)throw new WorkbenchError("BACKBOARD_MISSING_KEY","Backboard is not configured; no saved notes were used.",503);
    const assistant=await this.registry.get(userId);if(!assistant)return [];
    const data=await this.call(`/assistants/${safeId(assistant)}/memories/search`,"POST",{query:query.slice(0,3000),limit:5});
    const parsed=z.object({memories:z.array(memorySchema)}).safeParse(data);
    if(!parsed.success)throw new WorkbenchError("BACKBOARD_OUTPUT","Backboard memory search returned invalid notes.",502);
    return parsed.data.memories;
  }
  async check(){await this.call("/assistants?page=1&page_size=1");return {verifiedAt:new Date().toISOString()};}
  async mutate(userId:string,input:z.infer<typeof memoryMutationSchema>):Promise<void> {
    if(!process.env.BACKBOARD_API_KEY)throw new WorkbenchError("BACKBOARD_MISSING_KEY","Backboard is not configured. Add BACKBOARD_API_KEY locally.",503);
    await this.registry.locked(userId,async()=>{
      let assistant=await this.registry.get(userId);
      if(!assistant&&input.operation!=="save"){if(input.operation==="reset")return;throw new WorkbenchError("MEMORY_NOT_FOUND","No saved note exists for this user.",404);}
      if(!assistant){
        const data=await this.call("/assistants","POST",{name:"Get Me Hired private practice",system_prompt:"Storage for explicitly approved practice learning notes only."});
        const parsed=z.object({assistant_id:z.string().min(1)}).safeParse(data);
        if(!parsed.success)throw new WorkbenchError("BACKBOARD_OUTPUT","Backboard did not return an assistant identifier.",502);
        assistant=parsed.data.assistant_id;await this.registry.set(userId,assistant);
      }
      const path=`/assistants/${safeId(assistant)}/memories`;
      const notes=await this.rows(assistant);
      if(input.operation==="save"){
        if(notes.some(n=>n.metadata?.requestId===input.requestId||n.content===input.content))return;
        await this.call(path,"POST",{content:input.content,metadata:{requestId:input.requestId,source:"user-approved-practice-note"}});
      }else if(input.operation==="reset"){
        for(const note of notes)await this.call(`${path}/${safeId(note.id)}`,"DELETE");
        if((await this.rows(assistant)).length)throw new WorkbenchError("MEMORY_PENDING","Some notes are still present. Refresh and retry reset.",409);
      }else{
        if(!notes.some(n=>n.id===input.id))throw new WorkbenchError("MEMORY_NOT_FOUND","This note does not belong to your practice memory or was already removed.",404);
        await this.call(`${path}/${safeId(input.id)}`,input.operation==="edit"?"PUT":"DELETE",input.operation==="edit"?{content:input.content,metadata:{source:"user-approved-practice-note"}}:undefined);
      }
    });
  }
}
export const practiceMemory=new BackboardMemory();
