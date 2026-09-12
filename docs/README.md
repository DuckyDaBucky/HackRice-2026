# Get Me Hired — project documentation

- [Account profiles and invitation roadmap](17-profiles-and-invitations.md): Clerk-linked persistence, automatic experience criteria, UTC date handling and proposed blockchain invitations.
- [ElevenLabs handoff](18-elevenlabs-handoff.md): prepared question text and the boundary with the audio/video implementation.

**HackRice 2026 · CS interview preparation and employer interviews**

Initial planning baseline: September 12, 2026. The combined implementation now includes the authenticated development workbench, resume processing, account profiles and question planning alongside the camera recorder and interview voice slice from main. The documents below distinguish implemented behavior from proposed features; the workbench question pack and the interview session’s separate static/dynamic question sources remain separate integration boundaries. Reports provide feedback after answers; live captions and spoken prompts are not live candidate evaluation.

Get Me Hired is an exclusively video interview platform for behavioral and technical-behavioral interviews. Its structured practice experience is inspired by HackerRank, but coding exercises, coding contests, and a code execution judge are outside the current scope.

## Read this first

Current audit: main `192feef234ca127f198eb4cece3a1ad376232e6f`, September 12, 2026. The numbered build-slice documents retain historical checkpoints beneath explicit current-status notes.

Start with [current codebase](14-current-codebase.md) and [development guide](15-development-guide.md) for implementation facts; the product documents describe the target system.

| Document | Purpose |
| --- | --- |
| [Product brief](01-product-brief.md) | Vision, audience, scope, terminology and confirmed requirements |
| [Practice experience](02-practice-experience.md) | Resume parsing, personalized questions, recorded practice and post-interview reports |
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
| [Camera recorder build slice](16-camera-recorder-build-slice.md) | Reconciles this plan with the interview-practice foundation currently being implemented |
| [Camera recorder component](17-camera-recorder-component.md) | Spec for the capture component: states, interfaces, testability boundary |
| [Data model slice](18-data-model-slice.md) | Minimal interview-practice schema (sessions/questions/answer attempts), verified against the real DEV database |
| [Presage feasibility spike](19-presage-feasibility-spike.md) | Historical feasibility research; native wrapper now exists in presage-api/ |
| [Recording storage and playback](20-recording-storage-and-playback.md) | Implemented R2 upload wiring and proposed review flow and a timestamped feedback-marker timeline (depends on evaluation existing) |
| [Live interview voice](21-live-interview-voice.md) | ElevenLabs TTS + live captions + live follow-ups, implemented; live provider availability requires separate verification |
| [Change log](CHANGELOG.md) | Documentation changes and future implementation reconciliation |

## Status conventions

- **Confirmed:** directly requested by the founder.
- **Proposed:** a concrete design recommendation that can be revised.
- **Exploratory:** optional idea or unresolved feasibility, not an MVP commitment.
- **Deferred:** intentionally outside the recommended HackRice build slice.

The founder's requested product scope is wider than the proposed HackRice MVP. The delivery plan recommends sequencing; it does not cancel later requirements. Use the decision register when changing scope. Keep this folder in the existing repository when implementation lands; do not replace the application's future README or scaffold to match assumptions here.

- [Workbench and post-interview processing](16-workbench-and-processing.md): current scope, integration ownership, database import and verification boundaries.
