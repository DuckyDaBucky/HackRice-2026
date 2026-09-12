import {describe,it,expect} from "vitest";
import {planInterview,effectiveLevel} from "../src/lib/workbench/ai/planner";
import type {Corpus,Resume} from "../src/lib/workbench/schemas";
const profile:Resume={experienceLevel:"intern",experienceReason:"Explicit internship",sections:[],skills:["Python"],warnings:[],projects:[
  {id:"api",name:"Campus API",description:"Python backend API",skills:["Python"],competencies:[],contribution:"Implemented endpoints",decisions:["Batched queries"],outcomes:[],evidence:["Built a Python backend API."]},
  {id:"art",name:"Drawing",description:"Drawing",skills:[],competencies:[],contribution:null,decisions:[],outcomes:[],evidence:[]},
]};
const corpus={manifest:{version:"synthetic"},roles:[{id:"swe",matchingTerms:["API"],competencies:[],specialties:[{id:"backend",technologies:["Python"]},{id:"frontend",technologies:["CSS"]}]}],
 questions:Array.from({length:40},(_,i)=>({id:`q${i}`,scenarioId:`s${i}`,familyId:"swe",specialtyIds:[i%2?"frontend":"backend"],technologies:[i%2?"CSS":"Python"],level:[i%3?"intern":"senior"],category:i%2?"behavioral":"technical-behavioral"}))} as unknown as Corpus;
const target={familyId:"swe",specialtyId:"backend",technologies:["Python"],level:"unknown" as const,description:""};
describe("interview planning",()=>{
 it("uses the parsed level with an explicit target override",()=>{expect(effectiveLevel({profile,useMemory:false})).toBe("intern");expect(effectiveLevel({profile,target:{...target,level:"senior"},useMemory:false})).toBe("senior");});
 it("replays selection from a seed and varies with new seeds",()=>{const context={profile,target,useMemory:false};const a=planInterview(corpus,context,5,"a");expect(planInterview(corpus,context,5,"a").selection).toEqual(a.selection);expect(planInterview(corpus,context,5,"b").selection.selectedQuestionIds).not.toEqual(a.selection.selectedQuestionIds);expect(a.focus?.id).toBe("api");expect(new Set(a.seeds.map(q=>q.category)).size).toBe(2);});
 it("never repeats excluded seed IDs or scenarios",()=>{const a=planInterview(corpus,{profile,target,useMemory:false},5,"a",["q0","q1"]);expect(a.seeds.every(q=>!['q0','q1'].includes(q.id))).toBe(true);expect(new Set(a.seeds.map(q=>q.scenarioId)).size).toBe(a.seeds.length);});
 it("uses specialty, parsed experience and skills in weights",()=>{const a=planInterview(corpus,{profile,target,useMemory:false},5,"fixed");expect(a.selection.questionFactors.some(q=>q.factors.specialty>0&&q.factors.technologies>0&&q.factors.resumeSkills>0)).toBe(true);expect(a.selection.level).toBe("intern");});
 it("keeps missing evidence unknown and rejects invalid roles",()=>{expect(planInterview(corpus,{profile:{...profile,projects:[profile.projects[1]]},useMemory:false},2,"a").focus).toBeUndefined();expect(()=>planInterview(corpus,{target:{...target,specialtyId:"invalid"},useMemory:false},2,"a")).toThrow();});
});
