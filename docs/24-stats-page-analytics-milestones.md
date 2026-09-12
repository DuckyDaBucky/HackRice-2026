# Post-interview stats page: milestones and timeline

**Status:** working plan

**Companion:** [Interview agent and dashboard implementation brief](./22-interview-agent-and-dashboard-implementation.md),
[Interview agent validation milestones](./23-interview-agent-validation-milestones.md) — this doc
turns M4 ("Trustworthy report") and M5 ("Purposeful dashboard") into concrete, hackathon-scoped
build steps, and adds the presage-api biometric integration those docs left as exploratory.

This tracks the same four fields per milestone as `docs/23`: **Decision record**,
**Implementation evidence**, **Validation evidence**, **Gate result**. Update the status/branch
columns as work moves.

## Timeline overview

| # | Milestone | Depends on | Branch | Status |
| --- | --- | --- | --- | --- |
| S1 | Report data model + generation pipeline | M1, M3 (docs/23) | `t3code/build-interview-stats-analytics` | **In progress** |
| S2 | Derived process-mistake & transcript-marker analytics | S1 | `t3code/build-interview-stats-analytics` | **In progress** |
| S3 | Per-session report/timeline page | S1, S2 | `t3code/build-interview-stats-analytics` | **In progress** |
| S4 | presage-api biometric relay (server-to-server) | — | `t3code/presage-biometric-relay` | Not started |
| S5 | Aggregate analytics/stats page + charting | S3 | `t3code/build-interview-stats-analytics` | Not started |
| S6 | Dashboard wiring (replace raw totals per M5) | S3, S5 | `t3code/build-interview-stats-analytics` | Not started |

---

## S1 — Report data model + generation pipeline

### Claim

A completed session can produce a structured, evidence-linked set of findings (strengths, gaps,
insufficient-evidence) grounded in its transcripts, stored durably and queryable by the UI.

### Scope

- `report_findings` table + `ai_generations` rows with `purpose: "report"`.
- Evaluator prompt separate from the interviewer prompt (`docs/22...:141-142`).
- `POST /api/interviews/[sessionId]/report` (trigger) and
  `GET /api/interviews/[sessionId]/report` (read latest), ownership-checked.
- Deterministic fallback (`insufficient_evidence` per competency) on model failure/timeout.

### Implementation tasks

1. Add migration `app/migrations/0007_stats_analytics.sql`: `report_findings` table,
   `biometric_analyses` table (schema owned by S4, added here so one migration covers both),
   `interview_session_configs.biometrics_enabled boolean not null default false`.
2. Add matching Drizzle tables/types to `app/src/lib/db/schema.ts`.
3. Add `app/src/lib/reports/generator.ts`: Zod output schema, `GeneratedReportFindings` type,
   Gemini call via the existing `ChatGoogle` wrapper pattern (`app/src/lib/workbench/ai/gemini.ts`),
   fallback path, modeled on `app/src/lib/interviews/planner.ts`.
4. Add the report route handlers, reusing the ownership check pattern in
   `app/src/app/interview/v2-actions.ts`.

### Validation

- Unit tests for the Zod schema, the fallback path, and idempotent re-generation (new version each
  call, latest wins).
- Integration test: seeded completed session with transcripts -> report route -> `report_findings`
  rows exist with evidence turn IDs.

### Gate result

`In progress`

### S1 implementation evidence — Sep 12, 2026

- Added `app/migrations/0007_stats_analytics.sql` (additive): `report_findings`,
  `biometric_analyses` (schema shared with S4), and `interview_session_configs.biometrics_enabled`.
  Not yet applied to a development database from this worktree (no `.env.local`/`DATABASE_URL`
  present here); applying and re-verifying against a live DB is remaining S1 work.
- Added matching Drizzle tables/types to `app/src/lib/db/schema.ts`.
- Added `app/src/lib/reports/generator.ts` (evaluator prompt, Zod-validated model output,
  deterministic `insufficient_evidence` fallback on failure) and
  `app/src/lib/reports/persistence.ts` (durable-generation-before-model-call pattern, matching
  `beginSessionPlanning`/`completeSessionPlan` in `app/src/lib/interviews/persistence.ts`).
- Added server actions `generateSessionReport` / `getSessionReport` in
  `app/src/app/interview/report-actions.ts`, ownership-checked the same way as
  `app/src/app/interview/v2-actions.ts`.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test --run` (121 tests, 12 new) and `pnpm build`
  all pass.

---

## S2 — Derived process-mistake & transcript-marker analytics

### Claim

Structural mistakes (skips, timeouts, failed uploads) and transcript-level review markers (long
pauses, filler rate) are available to the UI without any new persisted judgment — they're computed
from data the session already has.

### Implementation tasks

1. `app/src/lib/analytics/process-events.ts` — pure function over session + plan + turns +
   artifacts.
2. `app/src/lib/analytics/transcript-markers.ts` — pure function over `audio_transcripts.segments`.

### Gate result

`Pass with stated risk` — both modules are implemented as pure functions with unit test coverage
(`app/tests/analytics-process-events.test.ts`, `app/tests/analytics-transcript-markers.test.ts`).
Not yet exercised against real session data end-to-end (no development database reachable from
this worktree).

---

## S3 — Per-session report/timeline page

### Claim

A candidate can open one session and see, in order, what happened, what the report found, and
where to watch/read the evidence.

### Implementation tasks

1. `app/src/app/interview/session/[sessionId]/report/page.tsx`.
2. `InterviewTimeline` component combining turns + S1 findings + S2 derived events, each linking to
   a signed playback URL (`createPlaybackUrl`, `app/src/lib/storage/r2.ts:51-55`) at the matching
   transcript timestamp.
3. Findings panel grouped by competency; processing/failed/retry states.
4. Biometric card (renders when S4 data exists for the session).

### Gate result

`In progress` — `app/src/app/interview/session/[sessionId]/report/page.tsx` renders findings and
an ordered timeline (`app/src/components/reports/InterviewReportView.tsx`) with a
generate/retry action (`app/src/components/reports/GenerateReportButton.tsx`). `pnpm build`
confirms the route compiles and typechecks against generated Next.js route types. Remaining: the
biometric card (depends on S4) and a manual walkthrough against a real completed session, which
requires a development database this worktree doesn't have configured.

---

## S4 — presage-api biometric relay (server-to-server)

### Claim

A recorded answer clip can be analyzed by `presage-api` without a browser SDK, because the app
server relays the already-uploaded clip to `presage-api` over the internal docker-compose network.

### Implementation tasks

1. `app/src/lib/biometrics/presage-client.ts`: `PRESAGE_API_URL` env (default
   `http://presage-api:8080`), `getObjectBuffer` helper in `r2.ts`, multipart POST to
   `/v1/videos/analyze` (`presage-api/openapi.yaml:39-108`), parse `VideoAnalysis`.
2. Sequential queue processor respecting presage-api's one-active-session-per-process limit
   (`409 SDK_BUSY`, `presage-api/src/session-coordinator.ts`).
3. Trigger on `media_artifacts.uploadStatus = 'uploaded'` when the session's `biometrics_enabled`
   flag is set, mirroring the transcription-after-upload trigger in
   `app/src/lib/interviews/persistence.ts`.

### Validation

- `docker compose exec app curl http://presage-api:8080/health` succeeds.
- End-to-end: enable biometrics on a test session, confirm `biometric_analyses` reaches
  `completed` with real metrics after a short clip upload.

### Gate result

`In progress` — implemented on `t3code/presage-biometric-relay`.

### S4 implementation evidence — Sep 12, 2026

- Added `app/migrations/0008_biometric_analysis_queue.sql` (unique `(artifact_id, provider)`
  constraint so a re-confirmed upload never queues a duplicate analysis).
- Added `app/src/lib/biometrics/`: `contracts.ts` (Zod-validated `VideoAnalysis` response shape,
  `PresageBusyError` for the SDK's single-active-session `409`), `presage-client.ts` (fetches the
  clip via a new `getObjectBuffer` helper in `app/src/lib/storage/r2.ts`, POSTs multipart to
  `PRESAGE_API_URL`, default `http://presage-api:8080` — the docker-compose internal hostname,
  never reachable from the browser), `persistence.ts` (queue, and a `pg_try_advisory_lock`-guarded
  batch runner serializing calls to respect presage-api's one-session-per-process limit),
  `processor.ts` (runs pending analyses sequentially, marks `completed`/`retryable_failed`).
- Added the `biometricsEnabled` opt-in end to end: `interviewSetupSchema`
  (`app/src/lib/interviews/contracts.ts`), the setup form checkbox
  (`app/src/app/interview/setup/page.tsx`, off by default), `beginSessionPlanning`'s insert and
  `getV2ResumeState`'s read (`app/src/lib/interviews/persistence.ts`).
- Wired the trigger in `confirmPersistedAnswerUpload`
  (`app/src/app/interview/v2-actions.ts`): queues an analysis and kicks a best-effort background
  run when an artifact upload is confirmed for a biometrics-enabled session; failures there never
  fail the upload confirmation itself.
- Added a manual retry path (`retrySessionBiometrics` in
  `app/src/app/interview/report-actions.ts`) and a `BiometricsCard` on the report page, separate
  from `FindingsPanel` — biometric output never feeds `report_findings`.
- `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test --run` (125 tests, 4 new) and `pnpm build` all
  pass. Not yet verified against a running `presage-api` container or a real recorded clip — this
  worktree has no development database or docker environment; that end-to-end pass, plus a real
  `SMARTSPECTRA_API_KEY`, is the remaining S4 work before this can leave "in progress."

---

## S5 — Aggregate analytics/stats page + charting

### Claim

A candidate can see trends across sessions, not just the latest one: completion rate, mistake
frequency by category, per-competency trend.

### Implementation tasks

1. Add **Recharts** as a dependency (no charting library currently installed anywhere in the
   repo).
2. Extend `getSessionStats` (`app/src/lib/sessions.ts:116-138`) with trend queries.
3. `app/src/app/stats/page.tsx` with trend charts + mistake-frequency breakdown.

### Gate result

`Not started`

---

## S6 — Dashboard wiring

### Claim

The home dashboard's "Your progress" block becomes a real entry point into feedback, not three
static counters.

### Implementation tasks

1. Replace the `StatRow` block (`app/src/components/Dashboard.tsx:163-168`) with a summary that
   links to the latest report (S3) and the full stats page (S5), per the M5 direction in
   `docs/22...:226-229`.

### Gate result

`Not started`
