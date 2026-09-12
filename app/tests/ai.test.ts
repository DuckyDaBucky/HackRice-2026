import {beforeEach,describe,it,expect,vi} from "vitest";
const authMock=vi.hoisted(()=>vi.fn());
vi.mock("@clerk/nextjs/server",()=>({auth:authMock}));
import {GET,POST} from "../src/app/api/dev/ai/[action]/route";
import {validateEvaluation,validateQuestions} from "../src/lib/workbench/ai/service";
import {dimensions} from "../src/lib/workbench/ai/contracts";
import {LocalAssistantRegistry} from "../src/lib/workbench/ai/registry";
import {mkdtemp,rm} from "node:fs/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
beforeEach(()=>{vi.stubEnv("NODE_ENV","development");authMock.mockResolvedValue({userId:null});});
describe("AI access boundaries",()=>{
 it("blocks every action in production and when unsigned",async()=>{
  for(const env of ["production","development"]){vi.stubEnv("NODE_ENV",env);for(const action of ["status","memory","questions","evaluate","chat","check"]){
   const context={params:Promise.resolve({action})};
   expect((await GET(new Request('http://localhost/api/dev/ai/'+action),context)).status).toBe(env==="production"?404:401);
   expect((await POST(new Request('http://localhost/api/dev/ai/'+action,{method:'POST'}),context)).status).toBe(env==="production"?404:401);
  }}
 });
 it("blocks foreign origins before provider access",async()=>{authMock.mockResolvedValue({userId:"synthetic"});expect((await POST(new Request("http://localhost/api/dev/ai/questions",{method:"POST",headers:{origin:"https://foreign.example"},body:"{}"}),{params:Promise.resolve({action:"questions"})})).status).toBe(403);});
});
describe("report integrity",()=>{
 const raw=()=>({summary:"Practice report",dimensions:dimensions.map(d=>({dimension:d,rating:5,rationale:"Review evidence",evidence:[]})),strengths:[],improvements:[],followUps:[],suggestedNotes:[]});
 it("never scores unsupported dimensions",()=>{const r=validateEvaluation(raw(),"I tested the API.");expect(r.evaluation.dimensions.every(d=>d.rating===null)).toBe(true);});
 it("rejects fabricated quotations and malformed question packs",()=>{const r=raw();r.dimensions[0].evidence=["Fabricated achievement"] as never[];expect(()=>validateEvaluation(r,"I tested the API.")).toThrow();expect(()=>validateQuestions({questions:[]},2,undefined,[],null)).toThrow();});
 it("isolates ownership mappings by user",async()=>{const dir=await mkdtemp(join(tmpdir(),"gmh-registry-"));try{const registry=new LocalAssistantRegistry(dir);await registry.set("user-a","assistant-a");expect(await registry.get("user-b")).toBeNull();expect(await registry.get("user-a")).toBe("assistant-a");await registry.locked("user-a",async()=>{await expect(registry.locked("user-a",async()=>undefined)).rejects.toMatchObject({code:"MEMORY_BUSY"});});}finally{await rm(dir,{recursive:true,force:true});}});
});
