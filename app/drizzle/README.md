# drizzle/ — STALE, DO NOT USE

`0000_bitter_deathbird.sql` is a stale baseline (3 tables) predating the
hand-applied `migrations/0001-0012` series. Never run `drizzle-kit
generate/migrate/push` against DEV — see `AGENTS.md` and `app/README.md`.
`migrations/` is the source of truth; apply via
`psql "$DATABASE_URL" -f migrations/<file>.sql`.
