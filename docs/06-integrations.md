# Integration plan and validation register

The founder named Backboard, Vultr, Presage SmartSpectra SDK, LangChain, Gemini, ElevenLabs and possibly Persona. Provider names express intended choices, not proof that a feature is supported, licensed, configured or operational. No credentials are documented here.

| Integration | Intended role | Status | Validate before implementation |
| --- | --- | --- | --- |
| Backboard | AI/context layer | Confirmed selection; exact responsibility unresolved | Context isolation, supported models, retention, deletion, streaming and SDK/API contract |
| Gemini | Question generation, follow-ups and evaluation candidate | Confirmed intended model family | Exact model, structured output, latency, cost, regional/data settings |
| LangChain | Possible orchestration around generation/context/tools | Confirmed intended library | Necessary responsibilities versus direct Backboard calls; supported versions |
| ElevenLabs | Spoken questions in practice and corporate screens; live voice if feasible | Confirmed | TTS versus conversational API, streaming, interruption, available voices, pricing and consent terms |
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
