import { Pool } from "pg";

declare global {
  var _pgPool: Pool | undefined;
}

export const db = global._pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = db;
}
