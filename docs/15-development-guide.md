# Development setup and verification guide

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

Source baseline: `17f33a59747a1e251334b28e6019602593f35f83`. Commands below follow the committed manifest and configuration. They were not executed during this docs-only review.

## Work in the application directory

The Git repository root holds `app/` and `docs/`; run application commands inside `app/`. The landing page is `app/src/app/page.tsx` relative to the repository root, not the generic scaffold README's `app/page.tsx`.

Use pnpm 11.3.0 as declared by `packageManager`, preserving the committed pnpm lockfile. `app/package.json` declares `"engines": { "node": ">=22.12.0" }` — this is Vitest 5's own floor (`^22.12.0 || ^24.0.0 || >=26.0.0`), not an arbitrary choice; Next.js itself only requires `>=20.9.0`, but `pnpm test` will not run correctly below the Vitest-driven floor. `@types/node` is pinned to `^22` to match.

```sh
cd app
pnpm --version
pnpm install --frozen-lockfile
cp .env.example .env.local
```

Copy the environment example only for a new setup; do not overwrite an existing `.env.local`. Fill local values from the team's authorized services. Do not commit real keys or database credentials. The ignore file excludes environment files while explicitly allowing `.env.example`.

## Environment contract currently in source

| Variable | Current purpose | Visibility |
| --- | --- | --- |
| NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY | Clerk instance's publishable key | Browser-visible by design |
| CLERK_SECRET_KEY | Clerk server credential | Server-only secret |
| NEXT_PUBLIC_CLERK_SIGN_IN_URL | /sign-in | Public route configuration |
| NEXT_PUBLIC_CLERK_SIGN_UP_URL | /sign-up | Public route configuration |
| NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL | / | Public fallback route |
| NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL | / | Public fallback route |
| DATABASE_URL | Connection string consumed by pg.Pool | Server-only secret |

The example database string is a placeholder and includes `sslmode=no-verify`. Confirm the database service's appropriate TLS settings before deployment; do not treat the example as a verified production configuration.

There are no committed variables or adapters for Backboard, Gemini, ElevenLabs, Presage, Persona, transcription or Vultr. Add their contracts with implementation rather than inventing required names in setup instructions.

## Existing commands

Run from `app/`:

```sh
pnpm dev
pnpm lint
pnpm build
pnpm start
```

These map to `next dev`, `eslint`, `next build` and `next start`. Start is the production-server command after a successful build. The scaffold README points to localhost:3000 for development; follow the server's printed address if that port is occupied.

No test, migration, seed, formatting or deployment script is defined. Do not claim any of those ran as part of a successful build. The build may require environmental/network resources such as configuration and font retrieval; record the actual failure rather than assuming code is faulty.

## Source-based verification checklist

After authorized local configuration:

1. Run lint and build and record command versions and output.
2. Visit the home page; verify the placeholder content and signed-out controls.
3. Complete sign-up/sign-in using a test account; verify the signed-in user control and sign-out behavior.
4. Visit the dedicated sign-in/sign-up paths and verify redirects.
5. Test database connectivity separately once a deliberate health check/query is implemented. A successful home-page render currently does not exercise `db.ts`.
6. When private routes/data are introduced, test unauthenticated, wrong-user and wrong-organization access, not just whether buttons are hidden.
7. Record results and unresolved environment issues in the handoff.

This is a checklist for future execution, not a passing test report.

## Adding the first interview slice

Proposed sequence compatible with the current structure:

- Keep the existing App Router and source alias; choose route names deliberately.
- Define profile/session/answer ownership and a migration approach before persisting interview data.
- Add explicit server authorization before exposing private resumes or recordings.
- Build resume/profile confirmation and one recorded answer flow.
- Implement transcription and AI adapters with validated schemas and visible job states.
- Add evidence-linked feedback and only then reuse the flow for corporate screening.
- Introduce workers/object storage/live transport only when the selected vertical slice needs them.

These are future engineering recommendations. None of the listed routes or services was created in this documentation update.

## Repository instructions

`app/AGENTS.md` states that this Next.js version may differ from prior conventions and requires reading relevant installed guides in `node_modules/next/dist/docs/` before writing code. `app/CLAUDE.md` references that file. Preserve these instructions and consult them on future code edits.

## Fetching and keeping docs current

During this review local HTTPS Git authentication was unavailable. The authenticated GitHub connector retrieved source at the pinned commit and is used for publishing this docs-only change. That does not synchronize the original local Git checkout or configure Git credentials.

When local authentication is available, inspect local status before fetching or pulling. The original local checkout may still have an unborn branch and untracked docs from the initial planning pass. Back up those files and reconcile collisions explicitly; do not force-reset or overwrite them as an automatic “sync.”
