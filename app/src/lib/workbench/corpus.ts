import "server-only";
import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { corpusSchema, manifestSchema, type Corpus } from "./schemas";
import { WorkbenchError } from "./errors";
const filenames = ["roles", "questions", "sources", "templates", "rubrics", "scenarios", "classification", "ranking", "methodology"] as const;
export async function researchDirectory() {
  const location = process.env.GET_ME_HIRED_RESEARCH_DIR;
  if (!location) throw new WorkbenchError("CORPUS_MISSING", "Set GET_ME_HIRED_RESEARCH_DIR to the external research folder.", 503);
  let dir: string;
  try { dir = await realpath(location); } catch { throw new WorkbenchError("CORPUS_MISSING", "The configured research folder does not exist.", 503); }
  const repo = resolve(process.cwd(), "..");
  if (dir === repo || dir.startsWith(repo + sep)) throw new WorkbenchError("CORPUS_LOCATION", "Research must live outside this repository.", 503);
  return dir;
}
export function validateReferences(corpus: Corpus) {
  const ids = (items: {id:string}[]) => {
    const set = new Set(items.map(x => x.id));
    if (set.size !== items.length) throw new Error("Duplicate IDs"); return set;
  };
  const roles = ids(corpus.roles), questions = ids(corpus.questions), sources = ids(corpus.sources), rubrics = ids(corpus.rubrics), scenarios = ids(corpus.scenarios);
  ids(corpus.templates);
  const specialties = ids(corpus.roles.flatMap(r => r.specialties));
  const normalized = new Set(corpus.questions.map(q => q.prompt.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim()));
  if (normalized.size !== questions.size) throw new Error("Duplicate prompts");
  const refs = (values: string[], set: Set<string>) => { if (values.some(v => !set.has(v))) throw new Error("Broken reference"); };
  for (const q of corpus.questions) {
    refs([q.familyId], roles); refs(q.specialtyIds, specialties); refs(q.sourceIds, sources); refs([q.rubricId], rubrics); refs([q.scenarioId], scenarios);
    const r = corpus.roles.find(r => r.id === q.familyId)!;
    refs(q.specialtyIds, new Set(r.specialties.map(s => s.id)));
  }
  for (const s of corpus.scenarios) { refs([s.familyId],roles); refs([s.specialtyId],specialties); refs(s.sourceIds,sources); }
  for (const item of [...corpus.roles,...corpus.templates,corpus.classification,corpus.ranking,corpus.methodology]) refs(item.sourceIds,sources);
  if (corpus.manifest.questionCount !== questions.size || corpus.manifest.familyCount !== roles.size || corpus.manifest.specialtyCount !== specialties.size) throw new Error("Count mismatch");
  return corpus;
}
export async function loadLocalCorpus(): Promise<Corpus> {
  const directory = await researchDirectory();
  try {
    const manifest = manifestSchema.parse(JSON.parse(await readFile(resolve(directory,"manifest.json"),"utf8")));
    const data: Record<string, unknown> = {manifest};
    for (const name of filenames) {
      const content = await readFile(resolve(directory,`${name}.json`),"utf8");
      if (createHash("sha256").update(content).digest("hex") !== manifest.files[`${name}.json`]) throw new Error("Checksum mismatch");
      data[name] = JSON.parse(content);
    }
    return validateReferences(corpusSchema.parse(data));
  } catch { throw new WorkbenchError("CORPUS_INVALID", "Research files failed schema, checksum or reference validation. Revalidate the external dataset.", 503); }
}

export async function loadCorpus(): Promise<Corpus> {
  if (process.env.GET_ME_HIRED_RESEARCH_SOURCE !== "database") return loadLocalCorpus();
  const version = process.env.GET_ME_HIRED_RESEARCH_VERSION;
  if (!version) throw new WorkbenchError("CORPUS_MISSING", "Set GET_ME_HIRED_RESEARCH_VERSION for database research.", 503);
  try {
    const { db } = await import("../db");
    const result = await db.query<{name:string;content:string;sha256:string;manifest_sha256:string}>(
      "SELECT d.name,d.content,d.sha256,v.manifest_sha256 FROM gmh_research.documents d JOIN gmh_research.datasets v USING(version) WHERE d.version=$1", [version]);
    const expected = new Set(["manifest.json", ...filenames.map(n=>`${n}.json`)]);
    if (result.rows.length !== expected.size) throw new Error("Document count mismatch");
    const data: Record<string, unknown> = {};
    const hashes: Record<string, string> = {};
    for (const row of result.rows) {
      if (!expected.delete(row.name)) throw new Error("Unexpected document");
      const checksum = createHash("sha256").update(row.content).digest("hex");
      if (checksum !== row.sha256 || (row.name === "manifest.json" && checksum !== row.manifest_sha256)) throw new Error("Checksum mismatch");
      hashes[row.name] = checksum;
      data[row.name.replace(/\.json$/, "")] = JSON.parse(row.content);
    }
    const corpus = validateReferences(corpusSchema.parse(data));
    if (corpus.manifest.version !== version) throw new Error("Version mismatch");
    for (const name of filenames) if (corpus.manifest.files[`${name}.json`] !== hashes[`${name}.json`]) throw new Error("Manifest mismatch");
    return corpus;
  } catch { throw new WorkbenchError("CORPUS_INVALID", "Database research could not be loaded or failed integrity validation.", 503); }
}
