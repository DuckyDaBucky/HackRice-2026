import {parseResume} from "../src/lib/workbench/parser";
import {generateQuestions,evaluateAnswer} from "../src/lib/workbench/ai/service";
import {loadCorpus} from "../src/lib/workbench/corpus";
import {db} from "../src/lib/db";
async function main(){
 const {profile}=await parseResume("Synthetic student. Software engineering intern: wrote Python API regression tests for a summer internship. Project: Campus API. I built a Python REST API for a class project, batched database queries to reduce duplicate calls, and wrote integration tests. I measured query counts before and after batching. Skills: Python, SQL.");
 const corpus=await loadCorpus();const role=corpus.roles.find(r=>r.label.toLowerCase()==="software engineering")??corpus.roles[0];
 const context={profile,target:{familyId:role.id,specialtyId:role.specialties[0].id,level:"unknown" as const,technologies:["Python"],description:"Backend internship building APIs"},useMemory:false};
 const {pack,selection}=await generateQuestions("synthetic-pipeline",{context,count:3});
 const focused=pack.questions.find(q=>q.projectId===selection.focusProjectId);
 if(!focused||selection.level!==profile.experienceLevel)throw new Error("Pipeline context mismatch");
 const report=await evaluateAnswer("synthetic-pipeline",{context,question:focused,answer:"I implemented the Campus API endpoints and regression tests. I saw repeated SQL queries during integration testing. I chose batching over caching to keep results fresh, then compared query counts before and after. My next step would be load testing with realistic concurrency."});
 console.log(JSON.stringify({passed:true,parsedExperience:profile.experienceLevel,questionCount:pack.questions.length,namedProjectQuestion:true,reportDimensions:report.evaluation.dimensions.length,dataset:selection.datasetVersion}));
}
main().catch(e=>{console.error(JSON.stringify({passed:false,code:e.code??"PIPELINE_FAILED"}));process.exitCode=1;}).finally(()=>db.end());
