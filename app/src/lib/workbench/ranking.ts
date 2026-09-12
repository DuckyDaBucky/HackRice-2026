import type { Project, Role } from "./schemas";
export const weights = {roleRelevance:35,competencyEvidence:25,ownership:15,technicalDepth:15,outcomes:10} as const;
const hasTerm = (haystack:string, term:string) => {
  const escaped = term.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g,"\\$&");
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`,"i").test(haystack);
};
export function rankProjects(projects: Project[], role?: Role, technologies:string[] = []) {
  return projects.map(project => {
    const searchable = [project.name,project.description,...project.skills,...project.evidence].join(" ");
    const targets = [...new Set([...(role?.matchingTerms ?? []),...technologies].map(t=>t.toLowerCase()))];
    const matched = targets.filter(term=>hasTerm(searchable,term));
    const competencyMatches = (role?.competencies ?? []).filter(term=>project.competencies.some(c=>hasTerm(c,term)) || project.evidence.some(e=>hasTerm(e,term)));
    const components = {
      roleRelevance: targets.length && searchable.trim() ? Math.round(100*matched.length/targets.length) : null,
      competencyEvidence: !role || !project.evidence.length ? null : Math.round(100*competencyMatches.length/Math.max(1,role.competencies.length)),
      ownership: project.contribution?.trim() ? 100 : null,
      technicalDepth: project.decisions.length ? Math.min(100,project.decisions.length*50) : null,
      outcomes: project.outcomes.length ? 100 : null,
    };
    const coverage = Object.entries(components).reduce((sum,[k,v])=>sum+(v===null?0:weights[k as keyof typeof weights]),0);
    const observed = Object.entries(components).reduce((sum,[k,v])=>sum+(v??0)*weights[k as keyof typeof weights]/100,0);
    return {project,components,coverage,score:coverage ? Math.round(observed*100/coverage):null,
      matched,competencyMatches,missing:Object.entries(components).filter(([,v])=>v===null).map(([k])=>k),
      explanation:"Prototype lexical relevance plus documented evidence availability. Not a measure of project quality or employability. Missing evidence is unscored; inspect coverage before comparing."};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1)||b.coverage-a.coverage||a.project.id.localeCompare(b.project.id));
}
export function populateTemplate(prompt:string,project?:Project) {
  if (!project?.name.trim()) return {text:prompt,missing:["project.name"]};
  const values:Record<string,string>={"project.name":project.name,"project.description":project.description};
  const missing:string[]=[];
  const text=prompt.replace(/\{([^}]+)\}/g,(full,key)=>{ if(!values[key]) {missing.push(key);return full;} return values[key]; });
  return {text,missing};
}
