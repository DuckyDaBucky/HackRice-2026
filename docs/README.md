# Get Me Hired — project documentation

**HackRice 2026 · CS interview preparation and employer interviews**

Initial planning baseline: September 12, 2026. Updated after static inspection of main at `17f33a59747a1e251334b28e6019602593f35f83`. The repository now has a Next.js/Clerk/PostgreSQL scaffold. Interview features remain planned. Source presence is distinguished from runtime verification; no app build, provider call or deployment was tested in this documentation update.

Get Me Hired is an exclusively video interview platform for behavioral and technical-behavioral interviews. Its structured practice experience is inspired by HackerRank, but coding exercises, coding contests, and a code execution judge are outside the current scope.

## Read this first

Start with [current codebase](14-current-codebase.md) and [development guide](15-development-guide.md) for implementation facts; the product documents describe the target system.

| Document | Purpose |
| --- | --- |
| [Product brief](01-product-brief.md) | Vision, audience, scope, terminology and confirmed requirements |
| [Practice experience](02-practice-experience.md) | Resume parsing, personalized questions, recorded and live practice |
| [Corporate experience](03-corporate-experience.md) | HR setup, screening invitations, interviewer assistance and review |
| [Evaluation and reports](04-evaluation-and-reports.md) | Evidence-based rubrics, report contents and scoring boundaries |
| [Architecture](05-architecture.md) | Proposed components, processing flow, session states and failure handling |
| [Integrations](06-integrations.md) | Backboard, Gemini, LangChain, ElevenLabs, Vultr, Presage and optional Persona |
| [Data and API design](07-data-and-api-design.md) | Proposed entities, isolation rules and endpoint contracts |
| [AI and context](08-ai-and-context.md) | Question generation, evaluation, context feedback and future model work |
| [Trust and camera features](09-trust-and-camera-features.md) | Recording consent, access, retention and experimental signals |
| [UX and accessibility](10-ux-and-accessibility.md) | Screens, interaction behavior, voice and avatar requirements |
| [HackRice delivery plan](11-hackrice-delivery-plan.md) | Recommended MVP, milestones, acceptance checks and demo |
| [Decisions and open questions](12-decisions-and-open-questions.md) | Confirmed direction, proposals, dependencies and unresolved choices |
| [First-push handoff](13-first-push-handoff.md) | How to reconcile this baseline with the first code push |
| [Current codebase](14-current-codebase.md) | Verified stack, routes, authentication, database utility and implementation gaps |
| [Development guide](15-development-guide.md) | Source-backed setup commands, configuration and verification steps |
| [Data model slice](18-data-model-slice.md) | Minimal interview-practice schema (sessions/questions/answer attempts), verified against the real DEV database |
| [Change log](CHANGELOG.md) | Documentation changes and future implementation reconciliation |

## Status conventions

- **Confirmed:** directly requested by the founder.
- **Proposed:** a concrete design recommendation that can be revised.
- **Exploratory:** optional idea or unresolved feasibility, not an MVP commitment.
- **Deferred:** intentionally outside the recommended HackRice build slice.

The founder's requested product scope is wider than the proposed HackRice MVP. The delivery plan recommends sequencing; it does not cancel later requirements. Use the decision register when changing scope. Keep this folder in the existing repository when implementation lands; do not replace the application's future README or scaffold to match assumptions here.
