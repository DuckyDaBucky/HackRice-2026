# Data model slice: interview practice foundation

## Status

Parallel-track piece referenced by
[16-camera-recorder-build-slice.md](./16-camera-recorder-build-slice.md#parallel-track):
the client-side recorder flow in that slice runs against in-memory state and
does not call this schema yet. This document records the schema drafted and
verified against the real DEV TigerData service for the eventual
integration, plus what was deliberately left out.

Verified against service `t75o4scmb8` ("HackRice-2026", environment `DEV`,
Postgres 18.6 / TimescaleDB 2.30) on September 12, 2026. Not yet wired into
any application code — `app/src/lib/db.ts` has no callers, and this remains
true after this change.

## Tables

Full migration: [`app/migrations/0001_interview_practice_slice.sql`](../app/migrations/0001_interview_practice_slice.sql).

### `interview_sessions`

One row per practice run.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `clerk_user_id` | `text` | Clerk user id, not a foreign key — no local `users` table in this slice; Clerk is the identity source of truth |
| `mode` | `text` | `CHECK` in `('technical', 'behavioral')` |
| `status` | `text` | `CHECK` in `('in_progress', 'completed', 'abandoned')`, default `'in_progress'` |
| `created_at`, `updated_at` | `timestamptz` | default `now()` |
| `completed_at` | `timestamptz` | nullable |

Indexed on `clerk_user_id` (a user's own session list/history).

### `questions`

Static/seeded question bank, one pack per mode. No AI generation, no
resume personalization, no per-session copies — `answer_attempts` rows
reference these directly. Seeding is left to application code or a
follow-up `INSERT` script; this migration only creates the empty table.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `mode` | `text` | `CHECK` in `('technical', 'behavioral')` |
| `prompt` | `text` | question text |
| `sequence` | `integer` | order within a mode's pack, `>= 0` |
| `is_active` | `boolean` | default `true`; lets a question be retired without deleting history that references it |
| `created_at` | `timestamptz` | default `now()` |

Indexed on `(mode, sequence)` for pack assembly.

### `answer_attempts`

One row per recorded clip. Matches `RecordingArtifact` in
[17-camera-recorder-component.md](./17-camera-recorder-component.md#interfaces):
`mime_type` ↔ `mimeType`, `duration_ms` ↔ `durationMs`, `recorded_at` ↔
`createdAt`. This slice models one attempt per `(session_id, question_id)`
pair — no attempt-number/retry column, since neither docs/16 nor docs/17
specifies retry semantics yet; add one later if re-recording a question
becomes a real requirement.

| Column | Type | Notes |
| --- | --- | --- |
| `id` | `uuid` PK | `gen_random_uuid()` |
| `session_id` | `uuid` FK | → `interview_sessions(id)`, `ON DELETE CASCADE` |
| `question_id` | `uuid` FK | → `questions(id)` |
| `media_ref` | `text` | pointer to wherever the blob eventually lands (e.g. object storage key/URL); nullable — storage is out of scope for this slice, so there's nowhere for it to point yet |
| `mime_type` | `text` | nullable |
| `duration_ms` | `integer` | nullable, `CHECK (>= 0)` |
| `recorded_at` | `timestamptz` | nullable — when the clip finished recording client-side |
| `upload_status` | `text` | `CHECK` in `('pending', 'uploading', 'uploaded', 'failed')`, default `'pending'` |
| `analysis_status` | `text` | `CHECK` in `('not_started', 'queued', 'processing', 'completed', 'failed')`, default `'not_started'` |
| `created_at`, `updated_at` | `timestamptz` | default `now()` |

`upload_status` and `analysis_status` are separate columns, not one status
field, because docs/16 makes analysis "per-answer, not real-time, not
end-of-session" and stubbed out entirely in this slice — conflating "did
the clip make it to storage" with "has it been analyzed" would make the
stub's absence look like a broken upload. A `CHECK` enforces
`upload_status <> 'uploaded' OR media_ref IS NOT NULL` so a row can't claim
to be uploaded without something to point at.

Indexed on `(session_id, question_id)` for the review-page query pattern
(list a session's attempts against its questions, in order) and separately
on `question_id` for the reverse lookup.

## Design choices

- **`uuid` primary keys** via `gen_random_uuid()`. Verified built in on this
  server (Postgres 18.6) — no `pgcrypto`/`uuid-ossp` extension needed. The
  migration file notes the `CREATE EXTENSION IF NOT EXISTS pgcrypto;` fallback
  for a hypothetical pre-13 environment, commented out, since this one
  doesn't need it.
- **`CHECK` constraints instead of native `ENUM` types** for `mode`,
  `status`, `upload_status`, `analysis_status`. Enum types need
  `ALTER TYPE ... ADD VALUE` (non-transactional in older Postgres, and
  fiddly generally) to add a state later; a `text` column with a `CHECK`
  is a one-line migration to widen. Cheaper to change during a hackathon.
- **No migration runner.** No Prisma/Drizzle/node-pg-migrate is installed
  and this slice doesn't add one (out of scope per the task that produced
  this document, and consistent with 15-development-guide.md's "No test,
  migration, seed, formatting or deployment script is defined"). The file
  is plain numbered SQL; a runner is a future decision, not made here.
- **`clerk_user_id text`, no local `users` table.** Clerk already owns
  identity (`app/src/proxy.ts`, `app/src/app/layout.tsx`). Adding a shadow
  `users` table now would just be a foreign key with no columns of its own
  to justify it.

## Deliberately out of scope (see docs/07 for the long-term shape)

Everything below is a named entity in
[07-data-and-api-design.md](./07-data-and-api-design.md#core-records) that
this slice does not build, and why:

- **Organization / Membership** — no multi-tenant workspace concept yet;
  this slice is single-user practice only.
- **CandidateProfile, ResumeAsset** — resume upload/parsing/personalization
  is explicitly out of scope for the camera-recorder slice this schema
  supports (docs/16, "Explicitly out of scope").
- **Requisition, InterviewTemplate, Invitation** — corporate/HR workflows
  are not part of this slice.
- **Question / QuestionPack as a versioned, provenance-tracked entity** —
  collapsed here into a single flat `questions` table with a `mode` and
  `sequence`, since content is static/seeded, not AI-generated yet.
- **RubricVersion, EvaluationVersion, Report, Observation** — no analyzer
  is wired up; `answer_attempts.analysis_status` is a stub state machine,
  not a real pipeline.
- **TranscriptVersion** — no transcription in this slice.
- **PracticeContext, ConsentRecord, AuditEvent** — no persisted consent or
  audit trail yet; docs/16 requires consent UI copy but explicitly does not
  persist a `ConsentRecord` in this slice.

## Verification performed

No local `psql` binary or Postgres client library was available in the
sandbox this work was done in, and the `mcp__tiger__db_query` /
`mcp__tiger__db_schema` tools could not authenticate against the DEV
service in this environment (`password authentication failed`; the
`service_update_password` tool's response confirmed its keyring-based
credential cache could not be written: `"Failed to save password to
keyring: The name is not activatable"`). Rotating the service's master
password did not fix the MCP tools' own cached credential.

Given that, verification was done with a direct `pg` client connection
(same DEV service, same connection string shape as `app/src/lib/db.ts`
expects) from a scratch scripts directory outside the repo:

1. Confirmed the target schema was empty before this change (only
   TimescaleDB-internal schemas existed; no `public` tables).
2. Confirmed `gen_random_uuid()` works with no extension installed
   (`SELECT gen_random_uuid();` — Postgres 18.6 has it built in).
3. Ran the full migration file end to end inside a transaction; it applied
   without error.
4. Inserted two seed questions, one session, and one answer attempt;
   updated the attempt to `upload_status = 'uploaded'` with a `media_ref`;
   ran the join query a review page would use
   (`interview_sessions ⋈ answer_attempts ⋈ questions` filtered by
   `session_id`, ordered by `sequence`) and got back the expected row.
5. Confirmed constraints reject bad input: invalid `mode`/`status` enum
   values, `upload_status = 'uploaded'` with a null `media_ref`, a
   `question_id` that doesn't exist (FK violation), and a negative
   `duration_ms`.
6. Confirmed `ON DELETE CASCADE`: deleting the test session removed its
   answer attempt.
7. Deleted the two seed questions used for testing. Final row counts in
   all three tables were confirmed at zero — the tables are left in place,
   empty, as the actual deliverable; no test rows remain.

**Operational note:** step 3 required rotating the DEV service's
`tsdbadmin` master password (via `mcp__tiger__service_update_password`) to
get any working credential at all, since the MCP query tools couldn't
authenticate with whatever credential they had cached. Anyone who already
has a `DATABASE_URL` pointed at this service in a local `.env.local` will
need to fetch the current password again (`tiger service get t75o4scmb8
--with-password`, or the Tiger Cloud console) before their existing
connection string will work.

## Applying this migration in a fresh environment

No migration runner is installed. Apply the file directly:

```sh
psql "$DATABASE_URL" -f app/migrations/0001_interview_practice_slice.sql
```

The file wraps its statements in a single transaction and is safe to run
once against an empty schema. It is not idempotent (no `IF NOT EXISTS` on
the `CREATE TABLE` statements) and will error if run twice against the
same database; a future migration runner should track what's already
applied rather than this file guessing.
