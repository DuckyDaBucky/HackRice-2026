import { requireDevUser, checkOrigin } from "@/lib/workbench/access";
import { loadCorpus, researchDirectory } from "@/lib/workbench/corpus";
import { extractResume, MAX_UPLOAD } from "@/lib/workbench/extraction";
import { parseResume } from "@/lib/workbench/parser";
import { describeLlm } from "@/lib/llm/provider";
import { resumeSchema } from "@/lib/workbench/schemas";
import { WorkbenchError } from "@/lib/workbench/errors";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { createHash, randomUUID } from "node:crypto";
import { z } from "zod";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{operation:string}>};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
function failure(error:unknown) {
  if(error instanceof WorkbenchError) return json({error:{code:error.code,message:error.message}},error.status);
  if(error instanceof z.ZodError || error instanceof SyntaxError) return json({error:{code:"INVALID_INPUT",message:"Check the submitted fields and try again."}},400);
  return json({error:{code:"FAILED",message:"Operation failed. Check local configuration and retry."}},500);
}
async function body(request:Request,limit:number) {
  if(Number(request.headers.get("content-length"))>limit) throw new WorkbenchError("TOO_LARGE","Request exceeds the allowed size.",413);
  const reader=request.body?.getReader();if(!reader) throw new WorkbenchError("EMPTY","No request body.");
  let size=0;const parts:Uint8Array[]=[];
  try {while(true){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new WorkbenchError("TOO_LARGE","Request exceeds the allowed size.",413);}parts.push(value);}}finally{reader.releaseLock();}
  return Buffer.concat(parts);
}
export async function GET(request:Request,context:Context) {
  try {await requireDevUser();const {operation}=await context.params;
    if(operation==="corpus") return json(await loadCorpus());
    if(operation==="status") return json({llm:describeLlm(),memory:process.env.BACKBOARD_API_KEY?"configured; test in AI playground":"not configured",spectra:"not connected"});
    return json({error:{code:"NOT_FOUND",message:"Not found"}},404);
  }catch(e){return failure(e);}
}
export async function POST(request:Request,context:Context) {
  try {
    const userId=await requireDevUser();checkOrigin(request);const {operation}=await context.params;
    if(operation==="extract") {
      const buffer=await body(request,MAX_UPLOAD);
      const filename=request.headers.get("x-file-name")||"";
      return json(await extractResume(buffer,filename));
    }
    if(operation!=="parse"&&operation!=="export") throw new WorkbenchError("NOT_FOUND","Not found",404);
    const payload=JSON.parse((await body(request,512000)).toString("utf8"));
    if(operation==="parse") {const {text,consent}=z.object({text:z.string().max(60000),consent:z.literal(true)}).parse(payload);if(consent)return json(await parseResume(text));}
    if(operation==="export") {
      const {profile}=z.object({profile:resumeSchema}).parse(payload);
      const folder=join(await researchDirectory(),"exports",createHash("sha256").update(userId).digest("hex").slice(0,24));
      await mkdir(folder,{recursive:true,mode:0o700});const name=`profile-${randomUUID()}.json`;
      await writeFile(join(folder,name),JSON.stringify({schemaVersion:"1.0.0",exportedAt:new Date().toISOString(),profile},null,2),{flag:"wx",mode:0o600});
      return json({message:`Saved ${name} in your local research exports folder.`,name});
    }
  }catch(e){return failure(e);}
}
