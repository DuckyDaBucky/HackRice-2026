import {createHash} from "node:crypto";
import type {Corpus,Resume} from "../schemas";
import type {AiContext} from "./contracts";
import {rankProjects} from "../ranking";
import {WorkbenchError} from "../errors";

export function effectiveLevel(context:AiContext):Resume["experienceLevel"] {
  return context.target?.level && context.target.level!=="unknown" ? context.target.level : context.profile?.experienceLevel??"unknown";
}
// Stable selection for replay; Gemini wording is deliberately not deterministic.
const draw=(seed:string,id:string)=> (parseInt(createHash("sha256").update(seed+":"+id).digest("hex").slice(0,8),16)+1)/4294967297;
export function planInterview(corpus:Corpus,context:AiContext,count:number,seed:string,excluded:string[]=[]) {
  const target=context.target, level=effectiveLevel(context);
  const role=corpus.roles.find(r=>r.id===target?.familyId);
  if(target?.familyId&&!role)throw new WorkbenchError("INVALID_ROLE","Choose a role from the current library.",400);
  const specialty=role?.specialties.find(s=>s.id===target?.specialtyId);
  if(target?.specialtyId&&!specialty)throw new WorkbenchError("INVALID_ROLE","Choose a specialty within the selected role.",400);
  const technologies=target?.technologies??[];
  const projects=rankProjects(context.profile?.projects??[],role,[...technologies,...(specialty?.technologies??[])]);
  const banned=new Set(excluded);
  const skills=new Set((context.profile?.skills??[]).map(s=>s.toLowerCase()));
  const pool=corpus.questions.filter(q=>(!role||q.familyId===role.id)&&!banned.has(q.id));
  const ranked=pool.map(question=>{
    const factors={base:1,specialty:specialty&&question.specialtyIds.includes(specialty.id)?6:0,
      experience:level!=="unknown"&&question.level.includes(level)?4:0,
      technologies:Math.min(3,question.technologies.filter(t=>technologies.some(x=>x.toLowerCase()===t.toLowerCase())).length)*2,
      resumeSkills:Math.min(3,question.technologies.filter(t=>skills.has(t.toLowerCase())).length)};
    const weight=Object.values(factors).reduce((a,b)=>a+b,0);
    return {question,factors,weight,priority:-Math.log(draw(seed,question.id))/weight};
  }).sort((a,b)=>a.priority-b.priority||a.question.id.localeCompare(b.question.id));
  const selected:typeof ranked=[];const scenarios=new Set<string>();
  const take=(category?:string)=>{
    const next=ranked.find(r=>!selected.includes(r)&&!scenarios.has(r.question.scenarioId)&&(!category||r.question.category===category));
    if(next){selected.push(next);scenarios.add(next.question.scenarioId);}
  };
  // Both categories and distinct scenarios keep a pack from repeating one topic.
  if(count>=2){take("behavioral");take("technical-behavioral");}
  while(selected.length<Math.max(count,8)){const before=selected.length;take();if(before===selected.length)break;}
  const eligible=projects.filter(r=>r.project.name.trim()&&r.project.evidence.length);
  // Sample only among the three strongest documented projects, close to the top.
  const best=eligible[0]?.score??0;
  const focusPool=eligible.filter(r=>(r.score??0)>=best-15).slice(0,3);
  const focus=focusPool.map(r=>({r,key:-Math.log(draw(seed,r.project.id))/Math.max(1,(r.score??0)*r.coverage/100)})).sort((a,b)=>a.key-b.key)[0]?.r;
  return {seeds:selected.map(s=>s.question),focus:focus?.project,projects,
    selection:{seed,level,levelSource:target?.level&&target.level!=="unknown"?"target":"parsed-profile",datasetVersion:corpus.manifest.version,
      selectedQuestionIds:selected.map(s=>s.question.id),focusProjectId:focus?.project.id??null,
      candidates:pool.length,questionFactors:selected.map(s=>({id:s.question.id,weight:s.weight,factors:s.factors})),
      projectScores:projects.map(p=>({id:p.project.id,score:p.score,coverage:p.coverage,components:p.components,missing:p.missing})),
      warnings:pool.length?[]:["No unused corpus questions match this role; generated questions have no corpus provenance."]}};
}
