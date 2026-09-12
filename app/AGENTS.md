<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Database (Drizzle + Postgres)

- Query through the typed Drizzle client: `import { orm } from "@/lib/db"`.
  Raw `db.query` is reserved for `scripts/` and one-off SQL the query
  builder cannot express.
- Models live in `src/lib/db/schema.ts` and must mirror the live tables
  column-for-column, including the `gmh_accounts` / `gmh_research` schemas
  and the VOD layer (`media_artifacts`, `audio_transcripts`).
- Migrations in `migrations/` are applied by hand via
  `psql "$DATABASE_URL" -f app/migrations/<file>.sql`. Every model change
  needs a matching migration entry and vice versa. Do NOT run
  `drizzle-kit generate/migrate` against the DEV database: its snapshot
  predates the hand-applied `0001`–`0004` series and would emit a
  duplicative/broken migration (never replay the `0000` baseline either).
