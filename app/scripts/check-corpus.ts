import { loadCorpus } from "../src/lib/workbench/corpus";
async function main(){
const corpus=await loadCorpus();
console.log(JSON.stringify({validated:true,version:corpus.manifest.version,questions:corpus.questions.length,families:corpus.roles.length,specialties:corpus.roles.flatMap(r=>r.specialties).length,sources:corpus.sources.length}));
}
main().catch(() => { console.error("Corpus validation failed"); process.exitCode = 1; }).finally(async () => { if (process.env.GET_ME_HIRED_RESEARCH_SOURCE === "database") { const { db } = await import("../src/lib/db"); await db.end(); } });
