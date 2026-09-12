# Hiring flow setup runbook (solana branch)

This branch implements the employer-directed recorded interview flow. It does **not** merge to `main` automatically.

## Prerequisites

1. Apply migration `app/migrations/0008_hiring_flow.sql` to your Postgres database.
2. Configure Clerk organizations with admin/recruiter roles.
3. Server-provision organizations via `/hr` (arbitrary Clerk orgs grant nothing until provisioned).

## Environment

Copy `app/.env.example` and set:

| Variable | Purpose |
| --- | --- |
| `HIRING_ENABLED=true` | Gate all hiring routes after setup |
| `PERSONA_*` | Sandbox inquiry template + webhook secret |
| `SOLANA_*` | Devnet RPC, program ID, service/verifier keypairs |
| `ELEVENLABS_API_KEY` | Reused for Scribe final transcription |
| `HIRING_WORKER_SECRET` | Protects `POST /api/hiring/worker` |

Persona sandbox outcomes must be labeled as sandbox in the UI. ElevenLabs Scribe produces final evidence; browser captions remain provisional.

## Solana program

Anchor workspace: `solana/programs/get_me_hired/`

- Opaque invitation commitments and report-release masks on devnet only.
- Backend outbox: `app/src/lib/solana/outbox.ts` with reconciliation worker.
- Set `SOLANA_DRY_RUN=true` for local development without broadcasting.

## Worker

Poll processing jobs:

```bash
curl -X POST http://localhost:3000/api/hiring/worker -H "x-worker-secret: $HIRING_WORKER_SECRET"
```

Handles transcription → evaluation → report revision → solana reconcile → retention.

## Demo journey

1. HR: `/hr` → create job → add candidate → confirm email → generate/approve questions → copy invitation message.
2. Candidate: open fragment link → verify Clerk email → Persona → enter interview → record/submit.
3. HR: `/hr/interviews/[sessionId]/report` → review → release sections.
4. Candidate: `/candidate/feedback/[sessionId]` → see permitted sections only.

## Retention

Completed interviews: delete private data 30 days after completion. Never-completed: 30 days after invitation expiry/revocation. Opaque Solana audit commitments may remain.
