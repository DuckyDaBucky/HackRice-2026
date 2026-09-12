# Development setup and verification guide

Current reference: main `192feef234ca127f198eb4cece3a1ad376232e6f`, September 12, 2026. See [code map](14-current-codebase.md) for implementation and verification limits.

## Application setup

Run in `app/`, using Node >=22.12.0 and pnpm (manifest declares 11.3.0):

```sh
pnpm install --frozen-lockfile
pnpm dev --hostname localhost --port 3000
```

For a new setup only, copy `.env.example` to `.env.local`; never overwrite existing credentials. Public pages can load without Clerk keys. The authenticated dashboard, profiles and workbench require configured Clerk, and database-backed behavior requires the appropriate schema and connection. Prefer one consistent localhost hostname when testing sign-in cookies.

## Configuration

| Variables | Consumer |
| --- | --- |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY` | Clerk client/server identity; only the publishable key is public. |
| `NEXT_PUBLIC_CLERK_SIGN_IN_URL`, `NEXT_PUBLIC_CLERK_SIGN_UP_URL`, fallback redirect variables | Clerk route configuration from the example. |
| `DATABASE_URL` | pg/Drizzle, profiles, sessions, attempts and optionally research. |
| `GOOGLE_API_KEY`, `GEMINI_MODEL` | Workbench LangChain provider; configured default is `gemini-3.6-flash`. |
| `GEMINI_API_KEY` | Separate interview question/follow-up routes; they hardcode their model rather than reading `GEMINI_MODEL`. |
| `BACKBOARD_API_KEY` | Explicitly approved practice memory notes. |
| `GET_ME_HIRED_RESEARCH_DIR` | External corpus/archive and explicit exports; never source imports or public assets. |
| `GET_ME_HIRED_RESEARCH_SOURCE`, `GET_ME_HIRED_RESEARCH_VERSION` | Local or versioned database corpus selection. |
| `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET` | Private media storage and signed URLs; bucket CORS must allow intended origins. |
| `ELEVENLABS_API_KEY`, `ELEVENLABS_VOICE_ID` | Interview speech endpoint and optional default voice. |

Keep secrets server-side and out of Git. The example database URL uses `sslmode=no-verify`; validate production TLS configuration with the service. Presence of a key does not prove provider availability.

## Commands and data operations

```sh
pnpm test
pnpm lint
pnpm build
pnpm start
```

Stop development before building in the same directory to avoid sharing `.next` output. The test configuration includes both `tests/**/*.test.ts` and `src/**/*.test.ts` (75 tests at this checkpoint).

Database scripts: `db:generate`, `db:migrate`, `db:push`, `db:studio`. Review `drizzle/` and `migrations/` against the database's actual applied history before any write; these commands are not interchangeable. Profile setup is in `scripts/setup-profiles.ts`. No migrations were executed in this docs audit.

Research commands: `import:research`, `verify:research-db`, `check:corpus`. Imports validate version/hash/schema integrity and use a transaction; retain the external archive.

Provider checks: `check:gemini`, `check:ai`, `check:memory`; standalone pipeline/profile checks also exist under `scripts/`. These use configured services, may incur usage and are separate from unit tests. `setup:r2-cors` mutates bucket CORS; review intended origins first.

## Verification checklist

Check both anonymous landing and signed-in dashboard, sign-in/out, development-only gates, cross-user profile/session access, malformed inputs and provider failure states. Then separately test camera permissions, durable upload, session resume, speech, captions and report handoff. A successful build does not prove those service flows.

The latest merge checks passed tests/lint and builds with and without Clerk. Full media/provider acceptance remains separate. The waitlist is a clearly labeled preview, not a subscription service.

## Presage service and repository workflow

Use the separate [Presage README](../presage-api/README.md) for npm commands, native runtime requirements, keys and Docker setup. It is not started by `pnpm dev` and has no end-user authentication of its own.

Follow `app/AGENTS.md` and installed Next.js guides for code changes. Inspect local Git status before synchronization. Publishing through the GitHub connector does not update local branches or configure Git credentials; preserve local files when reconciling a checkout.
