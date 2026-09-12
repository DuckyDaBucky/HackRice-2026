import { parseResume } from "../src/lib/workbench/parser";
import { WorkbenchError } from "../src/lib/workbench/errors";
async function main(){
const text="Synthetic candidate. Project: Library Queue. Built a Python API for a class project, added request validation and wrote unit tests. Used SQLite. Personally implemented the API. Compared a queue with synchronous execution. No employment history supplied.";
try {const result=await parseResume(text);console.log(JSON.stringify({success:true,model:result.model,projects:result.profile.projects.length,sections:result.profile.sections.length,warnings:result.profile.warnings.length}));}catch(e){console.log(JSON.stringify({success:false,code:e instanceof WorkbenchError?e.code:"FAILED",message:e instanceof WorkbenchError?e.message:"Provider check failed"}));process.exitCode=1;}
}
void main();
