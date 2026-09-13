import { readFileSync } from "node:fs";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const file = process.argv[2];
  if (!file) throw new Error("usage: apply-migration-tmp.ts <path>");
  const sql = readFileSync(file, "utf8");
  await pool.query(sql);
  console.log(JSON.stringify({ applied: file }));
}

main()
  .catch((e) => {
    console.error(JSON.stringify({ passed: false, error: String(e) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
