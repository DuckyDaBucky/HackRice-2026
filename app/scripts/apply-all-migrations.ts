import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const dir = join(process.cwd(), "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();

  for (const file of files) {
    const sql = readFileSync(join(dir, file), "utf8");
    await pool.query(sql);
    console.log(JSON.stringify({ applied: file }));
  }
}

main()
  .catch((error) => {
    console.error(JSON.stringify({ passed: false, error: String(error) }));
    process.exitCode = 1;
  })
  .finally(() => pool.end());
