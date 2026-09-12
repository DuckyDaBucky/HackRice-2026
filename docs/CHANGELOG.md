# Documentation change log

## September 12, 2026 — main documentation audit

- Replaced scaffold-only code/setup references with the merged landing, dashboard, optional Clerk, workbench, recording, R2, voice and native Presage inventory.
- Clarified separate Gemini keys, the question-pack handoff gap, automatic experience classification and prepared-only versus actual TTS paths.
- Corrected obsolete authentication-loop and test-count statements; recorded 75 tests and builds with/without Clerk as the latest merge evidence, not new provider acceptance.
- Marked initial media/data/Presage slice documents as historical and distinguished upload helpers from completed timestamped report playback.
- No application code, credentials, corpus content, migrations or service configuration changed in this audit.


## September 12, 2026 — combine workbench and interview slices

- Preserved main's recording, voice, captions, migrations and documentation alongside the development workbench and account profiles.
- Combined dependency requirements and both test directories; 64 tests pass.
- Kept both Gemini configuration names explicit: `GOOGLE_API_KEY` for the workbench and `GEMINI_API_KEY` for interview follow-ups.
- The workbench question pack still needs to be connected to the interview session; merging the slices does not imply that handoff or recording storage is complete.

## September 12, 2026 — processing scope and research storage

- Replaced live analysis assumptions with post-interview reports and recording playback.
- Retained a private HR answer-guidance overlay as a proposed feature.
- Documented the development workbench, paused Gemini ownership and research import safeguards.
- Distinguished corpus storage from future Backboard user memory and documented future subtitle sizes.
## 2026-09-12 — PR review fixes (camera hook, DB constraints, Node version)

- Fixed four real bugs in `useCameraRecorder.ts` found by automated PR
  review: a `getUserMedia` continuation could leak an active camera if the
  component unmounted while permission was pending; `durationMs` didn't
  account for paused time; `MediaRecorder` construction/`.start()` weren't
  wrapped in `try`/`catch` so an unsupported device would throw instead of
  surfacing the existing error UI; and camera/mic disconnection wasn't
  detected outside of active recording (added `track.onended` listeners).
- Confirmed one flagged issue (camera reopening every question) was
  already fixed by an earlier refactor in this session — no separate fix
  needed, replied on the PR noting why.
- Added `app/migrations/0002_data_integrity_fixes.sql`: unique constraints
  on `(session_id, question_id)` and `(mode, sequence)`, composite FKs
  enforcing an `answer_attempts` row's session and question agree on
  `mode`, and an `updated_at` trigger. Applied and each constraint
  individually verified (rejects the bad case) against the real DEV
  TigerData service, not just applied without error.
- Declared `"engines": { "node": ">=22.12.0" }` in `app/package.json` and
  bumped `@types/node` to `^22` — Vitest 5 requires Node ≥22.12 and the
  repo previously declared no Node version while still carrying Node 20
  types, so `pnpm test` wasn't guaranteed to work outside this sandbox.

## 2026-09-12 — Live interviewer voice (ElevenLabs), Gemini model fixes

- Built the live-voice loop: `useTextToSpeech` + `POST /api/interview/speak`
  (ElevenLabs TTS), `useLiveCaptions` (Web Speech API), wired into
  `CameraRecorder.tsx` so the interviewer speaks each question, listens
  for a live follow-up trigger via the existing `should-request`/Gemini
  pipeline, and speaks that follow-up if one fires.
- Discovered and fixed: `gemini-2.5-flash` no longer available on the
  configured key (model deprecated), moved to `gemini-3.6-flash`; that
  model rejects `thinkingConfig.thinkingBudget: 0` (must be >0),
  `128` verified as a working low-latency value.
- Confirmed free-tier Gemini rate limiting (429 after ~5 requests) and
  confirmed the follow-up route's existing graceful-degradation behavior
  handles it correctly (returns no follow-up rather than erroring).
- Fixed an unrelated typo in `.env.local` (`CxcLERK_SECRET_KEY`) that was
  returning 500s on every route.
- Added 21-live-interview-voice.md. Blocked on obtaining a real
  `ELEVENLABS_API_KEY` — no way to provision one in this environment;
  everything else is built and ready.

## 2026-09-12 — Live captions/follow-ups, layout fixes, recording storage spec

- Built the live in-call feature: `app/src/lib/follow-up/` (pure
  prompt-building, response-parsing, and pause-detection logic, all
  Vitest-tested) plus `POST /api/interview/follow-up`, which calls Gemini
  with `thinkingConfig.thinkingBudget: 0` since default thinking-mode
  latency (multiple seconds) is unacceptable for a live in-call feature.
  Verified against the real Gemini API, not mocked.
- Fixed a real layout bug: `flex-1` on the tile grid was inert because its
  parent wasn't a flex container, leaving dead space below the tiles.
- Fixed the call screens being scrollable: they used `min-h-[100dvh]`
  (a floor, not a cap) stacked under the global site header, so total
  page height always exceeded one viewport. The header is now hidden on
  `/interview` routes (`SiteHeader.tsx`) since a call screen shouldn't
  have a site nav floating above it anyway, and the call screens use a
  fixed `h-[100dvh]` instead of `min-h-[100dvh]`.
- Added 20-recording-storage-and-playback.md: object storage upload flow
  (buildable now) and a timestamped feedback-marker data contract for a
  future playback timeline (depends on transcription/evaluation existing
  first, which they don't yet).

## 2026-09-12 — Presage feasibility spike

- Researched Presage SmartSpectra's actual platform support (public docs
  and GitHub, no code written against it): native-only (Android, iOS,
  C++, Node.js/Electron), no browser or WebAssembly build, no REST/cloud
  API for uploading video frames from a web client.
- Recorded this as a platform mismatch against our browser-based Next.js
  app, not a missing-API-key problem, and laid out three real options
  (Electron wrapper, standalone Node.js spike, or fake the values for the
  web demo) for whoever picks up the biometric piece.
- Scope: documentation only.

## 2026-09-12 — Interview practice data model slice

- Added `app/migrations/0001_interview_practice_slice.sql`: `interview_sessions`, `questions`, `answer_attempts` tables covering the practice flow in 16-camera-recorder-build-slice.md and 17-camera-recorder-component.md.
- Verified the migration against the real DEV TigerData service (`t75o4scmb8`, Postgres 18.6): applied it, inserted and queried sample rows, confirmed enum/FK/check constraints and cascade delete behave as intended, then removed the sample rows.
- Added 18-data-model-slice.md documenting the schema, the deliberately deferred entities from 07-data-and-api-design.md, and how to apply the migration by hand (no runner installed).
- Scope: `app/migrations/` and documentation only; no application code, dependency or lockfile changes.

## 2026-09-12 — Camera recorder build slice

- Adopted "Get Me Hired" naming and the Milestone 1/2 delivery sequence as
  source of truth for the interview-practice foundation being implemented
  now.
- Recorded the decision to start with a static question bank per mode
  (Technical/Behavioral) rather than resume-driven personalization, citing
  the fallback path already documented in the practice-experience plan.
- Recorded the per-answer (not real-time, not end-of-session) analysis
  pipeline decision in this repo's entity names.
- Added the camera recorder component spec, including the consent-notice
  requirement from the trust-and-camera-features doc and the testability
  boundary between pure logic (unit-tested) and browser-API code (manually
  validated).
- Data model work for this slice is tracked separately as a parallel track
  so client-side recording and schema design aren't blocking each other.
- Scope: documentation only in this entry; implementation follows in the
  same working session.

## 2026-09-12 — First implementation reconciliation

- Inspected immutable main snapshot `17f33a59747a1e251334b28e6019602593f35f83` through the authenticated GitHub connection.
- Added a technical code map and development guide for Next.js 16.3.5, React 19.2.8, pnpm 11.3.0, Clerk and the PostgreSQL pool.
- Updated every planning document with current implementation status and preserved future scope.
- Documented missing authorization, schema, routes, media pipeline, AI adapters, tests and deployment configuration.
- Clarified that setup commands are source-derived and not runtime-tested; standard local fetch still requires credentials.
- Scope: documentation files only; no application source, dependency, lockfile or configuration changes.


## 2026-09-12 — Initial founder-plan baseline

- Established Get Me Hired as a HackRice CS video interview product.
- Documented separate practice/corporate workspaces and recorded/live formats.
- Expanded resume personalization, HR screening, interviewer assistance and reporting flows.
- Proposed architecture, entities, API contracts and AI/context boundaries.
- Recorded named providers without claiming unverified capabilities or completed integration.
- Marked Presage service, camera assistance, Persona, avatars, custom models and meeting bots by maturity/scope.
- Proposed job-relevant evaluation, excluding age and camera/physiological signals from hiring scores.
- Added a recommended HackRice delivery sequence and first-push reconciliation guide.

Implementation status: documentation only. No remote publish or application implementation performed as part of this baseline.
