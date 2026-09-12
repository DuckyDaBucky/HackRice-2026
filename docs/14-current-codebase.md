# Current codebase: technical reference

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

Snapshot: `17f33a59747a1e251334b28e6019602593f35f83`, main, reviewed September 12, 2026. This document records static source observations. “Present” does not mean successfully run, tested or deployed.

## Repository layout

```text
README.md                       root pointer to app/
app/
  AGENTS.md                     instructions for future code edits
  README.md                     generic scaffold instructions
  package.json                  scripts and declared dependencies
  pnpm-lock.yaml                committed dependency resolution
  pnpm-workspace.yaml           build/release-age package policy
  .env.example                  Clerk and database configuration template
  next.config.ts                default empty Next configuration
  tsconfig.json                 strict typing and source alias
  eslint.config.mjs             Next core-web-vitals and TypeScript configs
  postcss.config.mjs            Tailwind PostCSS plugin
  src/
    proxy.ts                    Clerk request middleware
    lib/db.ts                   node-postgres pool
    app/
      layout.tsx                fonts, metadata, Clerk provider and header
      globals.css               Tailwind import, colors and typography
      page.tsx                  placeholder home
      sign-in/[[...sign-in]]/page.tsx
      sign-up/[[...sign-up]]/page.tsx
docs/                           requirements, proposed design and code context
```

There is one application package, not an implemented multi-service platform. No public media directory, database migration directory, API handlers, background workers, test suite or CI workflow is present in this snapshot.

## Stack and configuration

Source: [package manifest](https://github.com/DuckyDaBucky/HackRice-2026/blob/17f33a59747a1e251334b28e6019602593f35f83/app/package.json), [TypeScript config](https://github.com/DuckyDaBucky/HackRice-2026/blob/17f33a59747a1e251334b28e6019602593f35f83/app/tsconfig.json).

| Item | Manifest/config value | Interpretation |
| --- | --- | --- |
| Next.js | 16.3.5 | Exact framework dependency |
| React / React DOM | 19.2.8 | Exact rendering dependencies |
| Clerk | ^7.9.2 | Declared range; installed resolution governed by lockfile |
| pg | ^8.23.0 | PostgreSQL client dependency |
| Package manager | pnpm@11.3.0 | Explicit packageManager field |
| TypeScript | ^5; strict: true | Type checking enabled; noEmit |
| Tailwind / PostCSS plugin | ^4 | CSS utility framework |
| ESLint | ^9; eslint-config-next 16.3.5 | Lint configuration |
| TypeScript target | ES2017 | Compilation target, not supported-browser certification |
| Source alias | @/* maps to ./src/* | Imports can address source from app root |
| Package name | t3code-92051f96 | Scaffold identifier; not product branding |
| Node runtime | Not declared in engines | @types/node ^20 does not pin runtime |

Next config exports an empty configuration object. The workspace policy disallows the unrs-resolver build script and exempts listed Next 16.3.5 packages from minimum-release-age filtering. Preserve these files in a docs-only change; do not casually remove install policy to resolve an uninvestigated installation problem.

## Request and render flow

1. The request passes through the matching [proxy](https://github.com/DuckyDaBucky/HackRice-2026/blob/17f33a59747a1e251334b28e6019602593f35f83/app/src/proxy.ts), which exports `clerkMiddleware()`.
2. The [root layout](https://github.com/DuckyDaBucky/HackRice-2026/blob/17f33a59747a1e251334b28e6019602593f35f83/app/src/app/layout.tsx) wraps the header and page in `ClerkProvider`.
3. The header uses `Show` for signed-out/signed-in states. Signed-out visitors get `SignInButton` and `SignUpButton`; signed-in visitors get `UserButton`.
4. The home page renders a static heading and onboarding sentence. It does not query the database.
5. The optional catch-all sign-in/sign-up routes render Clerk's respective hosted UI components inside centered containers.

The matcher excludes many static files and explicitly includes API/trpc paths. This is matching configuration only: no API/trpc handlers are implemented. There is no explicit `auth.protect` call or role/ownership logic in the reviewed source. Conditional header rendering must not be mistaken for data-access enforcement.

## Data layer

Source: [db.ts](https://github.com/DuckyDaBucky/HackRice-2026/blob/17f33a59747a1e251334b28e6019602593f35f83/app/src/lib/db.ts).

`db` is exported as an existing `global._pgPool` or a new `Pool({ connectionString: process.env.DATABASE_URL })`. In non-production environments the pool is assigned to the global cache, supporting reuse during development reloads. The file does not set custom pool limits, timeouts, certificate options or query helpers.

There are no imports/callers of this utility in the other current source files. A configured URL and exported pool do not establish an actual database connection, persisted user record or successful query. No database tables, foreign keys, migration tool, tenant-scoping convention, transactions or repository abstraction have been committed.

The environment example names TigerData (TimescaleDB). This identifies intended service context but does not prove an extension, hypertable or provisioned service exists. The product primarily needs ordinary relational records first; any timeseries-specific design remains a future decision.

## Styles and branding

The layout loads Geist and Geist Mono through `next/font/google` and defines CSS variables. Global CSS imports Tailwind, maps theme tokens and sets system-preference light/dark colors. The explicit body font is Arial/Helvetica/sans-serif, so loaded font variables alone do not establish a consistent Geist body font. Root metadata and the home heading still say HackRice 2026.

These are implementation observations for future UI work, not changes made by this revision.

## Feature readiness

| Area | Source state | Remaining work |
| --- | --- | --- |
| Sign-in/up | Clerk provider, widgets and proxy present | Real configuration and runtime validation |
| Database | Pool utility present | Connectivity, schema, migrations, ownership rules |
| Practice/corporate separation | Not implemented | Workspace model, permissions, routes |
| Resume personalization | Not implemented | Upload, parsing, correction, generation |
| Recorded/live interviews | Not implemented | Capture, storage, transport, session state |
| Speech/transcription | Not implemented | Provider selection, adapters and processing |
| Reports/context loop | Not implemented | Rubric, evaluation, persistence and feedback |
| Presage/avatars/Persona | Not implemented | Feasibility and scoped integration design |
| Hosting | No deployment files | Decide/configure environment and operations |
| Tests | No test script or suite | Add tests alongside implemented behavior |

## Verification limits

All source files and configuration listed above were read from the pinned commit. The recursive repository tree was not truncated. Dependency installation, lint, build, login, database access and provider calls were not performed. There are no performance or production-readiness claims.

The root docs preserve the larger plan. Resolve differences between a future implementation and these descriptions by updating the snapshot and evidence links, not by changing working code to fit an old proposal.
