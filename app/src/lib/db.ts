import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./db/schema";

declare global {
  var _pgPool: Pool | undefined;
}

export const db = global._pgPool ?? new Pool({ connectionString: process.env.DATABASE_URL });

export const orm = drizzle(db, { schema });

if (process.env.NODE_ENV !== "production") {
  global._pgPool = db;
}
