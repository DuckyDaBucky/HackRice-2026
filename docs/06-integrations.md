# Integration plan and validation register

> Current scope (September 12, 2026): interview analysis is asynchronous. Feedback appears only in completed reports with recording playback; live analysis and live candidate feedback are out of scope. HR may have a private question-specific answer guide during an interview. See [current workbench and processing contract](16-workbench-and-processing.md). Historical implementation checkpoints below describe the earlier scaffold.

## Integrations observed in code

Reviewed source: `17f33a59747a1e251334b28e6019602593f35f83` on September 12, 2026. Static source inspection only; runtime behavior has not been tested.

| Integration | Source evidence | Actual scope |
| --- | --- | --- |
| Clerk | `@clerk/nextjs: ^7.9.2`; provider/header in layout; sign-in/sign-up pages; proxy; env placeholders | Authentication wiring present; valid credentials, successful login and authorization unverified |
| PostgreSQL / TigerData | `pg: ^8.23.0`; pool in `src/lib/db.ts`; TigerData comment in `.env.example` | Connection utility only; no query callers, schema or migrations |
| Next.js / React | Exact manifest versions 16.3.5 / 19.2.8 | Application scaffold |

Backboard, Gemini, LangChain, ElevenLabs, Presage and Persona have no dependencies, adapters or environment variables in this source snapshot. Vultr has no infrastructure files. No transcription provider is configured. The original intended-provider register below is retained as a planning register, not an implementation inventory.

The founder named Backboard, Vultr, Presage SmartSpectra SDK, LangChain, Gemini, ElevenLabs and possibly Persona. Provider names express intended choices, not proof that a feature is supported, licensed, configured or operational. No credentials are documented here.

| Integration | Intended role | Status | Validate before implementation |
| --- | --- | --- | --- |
| Backboard | AI/context layer | Confirmed selection; exact responsibility unresolved | Context isolation, supported models, retention, deletion, streaming and SDK/API contract |
| Gemini | Question generation, follow-ups and evaluation candidate | Confirmed intended model family | Exact model, structured output, latency, cost, regional/data settings |
| LangChain | Possible orchestration around generation/context/tools | Confirmed intended library | Necessary responsibilities versus direct Backboard calls; supported versions |
| ElevenLabs | Spoken question playback in practice and corporate screens | Confirmed | TTS versus conversational API, streaming, interruption, available voices, pricing and consent terms |
| Vultr | Hosting/infrastructure | Confirmed | Region, compute, storage, database, networking, secrets and budget |
| Presage SmartSpectra SDK | Camera-related service being ideated | Confirmed exploratory integration | SDK runtime/platform support, input requirements, supported outputs, limitations and permission to use |
| Persona | Unspecified optional feature | Exploratory | Which product/vendor is meant, intended purpose, consent, cost and necessity |
| Transcription | Audio-to-text with timing/speaker attribution as needed | Provider unresolved | Languages, streaming/batch behavior, diarization, error handling, retention and cost |
| Avatars/art packs | Optional visual interviewer | Confirmed optional presentation | Assets, rights, formats, lip-sync approach and accessibility |
| Teams/other conferencing | Future meeting assistant | Deferred | Official integration route, capture access, participant notice and tenant permissions |

## Resolve the AI ownership boundary

Two plausible configurations need a deliberate choice:

- Backboard owns conversation/context, while the application requests model operations through its supported interface.
- LangChain orchestrates workflows, while Backboard acts as a supported scoped context/memory provider and Gemini supplies generation.

Do not maintain two conflicting canonical conversation histories. Validate the chosen topology with a minimal end-to-end experiment before building the whole interview loop. Wrap vendor specifics behind small application interfaces so a provider change does not alter session or report schemas.

## Presage service spike

The SDK service is not yet designed. First establish where it can run, what camera inputs are supported, what outputs it actually provides, and what reliability/usage constraints apply. These documents make no promise of browser support, cheating detection, emotion recognition or physiological accuracy.

Proposed service result envelope: session-scoped consent reference, signal type, timestamp, value where supported, quality/availability status, SDK version and limitations. Missing or low-quality data must remain unavailable rather than imputed. Default the experiment off in corporate mode.

## Adapter contracts

Proposed application contracts: `parseResume`, `generateQuestions`, `transcribeAnswer`, `evaluateAnswer`, `synthesizeQuestion`, `retrievePracticeContext`, and `observeCameraSignals`. These are internal interface names, not real vendor endpoints.

Every adapter should define timeout, retryability, input/output validation, provenance and deletion behavior. Keep a local fixture/mock for the demo, clearly labeled whenever a provider is not live. Do not claim an integration is complete based only on possessing an API key.
