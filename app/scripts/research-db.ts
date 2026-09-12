import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { Pool } from "pg";
import { loadLocalCorpus, researchDirectory, validateReferences } from "../src/lib/workbench/corpus";
import { corpusSchema } from "../src/lib/workbench/schemas";

const hash = (text: string) => createHash("sha256").update(text).digest("hex");
async function main() {
  // Validate reference data before opening a database transaction.
  const corpus = await loadLocalCorpus();
  const directory = await researchDirectory();
  const names = ["manifest.json", ...Object.keys(corpus.manifest.files)].sort();
  const expectedNames = ["manifest.json", "roles.json", "questions.json", "sources.json", "templates.json", "rubrics.json", "scenarios.json", "classification.json", "ranking.json", "methodology.json"].sort();
  if (JSON.stringify(names) !== JSON.stringify(expectedNames)) throw new Error("Unexpected document set");
  const documents = await Promise.all(names.map(async name => {
    const content = await readFile(resolve(directory, name), "utf8");
    if (name !== "manifest.json" && hash(content) !== corpus.manifest.files[name]) throw new Error("Corpus changed during validation");
    return { name, content, sha256: hash(content) };
  }));
  if (documents.find(d => d.name === "manifest.json")!.content.trim() !== (await readFile(resolve(directory,"manifest.json"),"utf8")).trim()) throw new Error("Manifest changed");
  const reconstructed = Object.fromEntries(documents.map(d => [d.name.replace(/\.json$/, ""), JSON.parse(d.content)]));
  validateReferences(corpusSchema.parse(reconstructed));
  if (JSON.stringify(reconstructed.manifest) !== JSON.stringify(corpus.manifest)) throw new Error("Manifest changed during validation");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is missing");
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 30000, max: 1 });
  let client;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    const verifyOnly = process.argv.includes("--verify");
    if (!verifyOnly) {
      await client.query("SELECT pg_advisory_xact_lock(hashtext('gmh_research_import'))");
      await client.query("CREATE SCHEMA IF NOT EXISTS gmh_research");
      await client.query(`CREATE TABLE IF NOT EXISTS gmh_research.datasets (
        version text PRIMARY KEY, manifest_sha256 text NOT NULL, imported_at timestamptz NOT NULL DEFAULT now()
      )`);
      await client.query(`CREATE TABLE IF NOT EXISTS gmh_research.documents (
        version text NOT NULL REFERENCES gmh_research.datasets(version),
        name text NOT NULL, content text NOT NULL, sha256 text NOT NULL,
        PRIMARY KEY (version, name)
      )`);
      await client.query("INSERT INTO gmh_research.datasets(version,manifest_sha256) VALUES($1,$2) ON CONFLICT DO NOTHING", [corpus.manifest.version, documents.find(d=>d.name==="manifest.json")!.sha256]);
      for (const document of documents) {
        await client.query("INSERT INTO gmh_research.documents(version,name,content,sha256) VALUES($1,$2,$3,$4) ON CONFLICT DO NOTHING", [corpus.manifest.version,document.name,document.content,document.sha256]);
      }
    }
    const dataset = await client.query("SELECT manifest_sha256 FROM gmh_research.datasets WHERE version=$1", [corpus.manifest.version]);
    if (dataset.rows[0]?.manifest_sha256 !== documents.find(d=>d.name==="manifest.json")!.sha256) throw new Error("Version conflict: manifest differs");
    const stored = await client.query<{name:string;content:string;sha256:string}>("SELECT name,content,sha256 FROM gmh_research.documents WHERE version=$1 ORDER BY name", [corpus.manifest.version]);
    if (stored.rows.length !== documents.length) throw new Error("Stored document count mismatch");
    for (let i=0;i<documents.length;i++) {
      const actual=stored.rows[i], expected=documents[i];
      if (actual.name!==expected.name || actual.sha256!==expected.sha256 || hash(actual.content)!==expected.sha256 || actual.content!==expected.content) throw new Error("Database round-trip mismatch");
    }
    const result=validateReferences(corpusSchema.parse(Object.fromEntries(stored.rows.map(d=>[d.name.replace(/\.json$/,""),JSON.parse(d.content)]))));
    await client.query("COMMIT");
    console.log(JSON.stringify({verified:true,imported:!verifyOnly,version:result.manifest.version,documents:stored.rows.length,questions:result.questions.length,families:result.roles.length}));
  } catch (error) {
    if(client) await client.query("ROLLBACK").catch(()=>undefined);
    throw error;
  } finally { client?.release(); await pool.end(); }
}
main().catch(error=>{
  // Never log a connection string, credentials or document contents.
  const code=typeof error?.code==="string" ? error.code : "VALIDATION_OR_CONNECTION_FAILED";
  console.error(JSON.stringify({verified:false,code,message:code==="28P01"?"Database authentication failed; update DATABASE_URL.":"Import/verification failed. No successful import is claimed; inspect connection and dataset validation."}));
  process.exitCode=1;
});
