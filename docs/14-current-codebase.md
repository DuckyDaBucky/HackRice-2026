# Current codebase: technical reference

Audited against main `192feef234ca127f198eb4cece3a1ad376232e6f` on September 12, 2026. This replaces the original scaffold inventory. Source presence and runtime verification are distinguished below.

## Applications and stack

- `app/`: Next.js 16.3.5, React 19.2.8, TypeScript, Tailwind 4, Clerk, pnpm (manifest: 11.3.0), Node >=22.12.0. PostgreSQL uses a shared `pg` pool plus Drizzle ORM. LangChain/Google, Zod, PDF/DOCX extraction and AWS S3-compatible clients are installed.
- `presage-api/`: separate Fastify/TypeScript native SmartSpectra service, with HTTP video analysis and live WebSocket contracts, Docker configuration and injected-adapter tests. See its [README](../presage-api/README.md). It is not wired into the browser interview flow.
- `docs/`: product requirements, current implementation references and historical build slices. Number prefixes overlap; full filenames identify documents.

## Routes and behavior

| Route / source | Implemented behavior and boundaries |
| --- | --- |
| `/` | Marketing landing page for visitors; signed-in users receive the database-backed dashboard. Waitlist is a preview only and does not save email. |
| `/sign-in`, `/sign-up` | Clerk widgets when configured; setup message without a publishable key. |
| `/dev`, `/api/dev/*` | Development-only Clerk-authenticated workbench; extraction, profile review, corpus browser, project ranking, Gemini questions/chat/reports and Backboard controls. Writes check origin. |
| `/api/profile` | Clerk-owned profile persistence and version checks; available independently of development-only UI. |
| `/interview`, `/interview/setup`, `/interview/[mode]` | Public demo shell, setup options, camera/microphone recording, browser captions, spoken prompts, question progression and session resume UI. |
| `/api/interview/question`, `/follow-up`, `/speak` | Separate direct Gemini question/follow-up calls and ElevenLabs TTS. These public demo routes are excluded from Clerk middleware; do not describe them as protected corporate APIs. |
| `src/app/interview/actions.ts` | Authenticated session tracking, owner checks and signed R2 upload operations. Public camera access does not imply anonymous durable upload permission. |

`AppProviders` preserves the public interview route exception. Without a Clerk publishable key, public pages can render; profile APIs fail closed and development routes remain unavailable in production. With keys, the existing server-side identity checks still apply. Organization/HR authorization is not implemented.

## Data and media

`src/lib/db.ts` exports the pool and Drizzle ORM. `src/lib/db/schema.ts`, `drizzle/` and `migrations/` contain schema/migration assets. Session and answer-attempt helpers support the dashboard and upload tracking. Separate `gmh_accounts` and `gmh_research` schemas serve profiles and versioned research. Backboard note ownership uses an ignored local registry, not a production-ready shared ownership service.

`src/lib/storage/r2.ts` signs upload and playback URLs. `r2-sink.ts` uploads answer media and confirms status through owner-checked server actions. A signing helper is not a completed recording review player: the current session summary does not implement timestamped report playback. R2 credentials, bucket CORS and database state require separate validation. Do not run both migration approaches blindly against an existing database; reconcile its applied history first.

## AI boundaries

The workbench uses LangChain structured outputs and `GOOGLE_API_KEY` with `GEMINI_MODEL`. It classifies experience from resume evidence, selects weighted corpus seeds and relevant projects, and creates text packs. Users correct source facts; they do not choose their own experience level. Reports evaluate explicitly submitted text, not live camera behavior.

The interview route uses `GEMINI_API_KEY` and its own direct model requests. It has a seeded/static source and dynamic next-question generation from prior answers, but is not connected to the workbench's resume-grounded pack. Browser captions are not a durable, timestamp-aligned transcription service. The workbench speech plan remains `prepared-not-synthesized`; the separate interview TTS endpoint is implemented.

## Remaining product work

Connect the question-pack handoff, recording/transcript/report persistence and timestamped replay. Implement HR workspaces, invitations, interviewer answer overlays, optional avatars and subtitle size controls. Blockchain invitations remain documentation only. The native Presage wrapper needs a provisioned runtime test and application integration; its existence does not establish measurement validity or candidate scoring support.

## Verification evidence

The merge validation passed 75 app tests, ESLint, TypeScript through production builds, and production builds with and without Clerk keys. No-key HTTP checks passed for landing/sign-in/public interview rendering, blocked profile access and unavailable production development routes. Earlier synthetic Gemini/Backboard and research-database checks are recorded in the workbench docs; they were not rerun in this documentation audit. Live ElevenLabs synthesis, full R2 round trips, native SmartSpectra processing, production deployment and the complete resume-to-recording-to-report journey are not certified by these checks.
