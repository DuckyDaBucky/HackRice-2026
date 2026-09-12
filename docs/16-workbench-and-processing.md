# Workbench and processing contract

> Current revision: [account profiles and automatic experience](17-profiles-and-invitations.md) supersedes the earlier editable-experience, target-level override and temporary-profile statements below. [ElevenLabs handoff](18-elevenlabs-handoff.md) documents the implemented speech preparation boundary. Blockchain invitations remain documentation only.

## Product decision

All interview analyses are delivered after submission as reports with recording playback. No live candidate feedback, streaming score, live coaching or live camera interpretation is promised. The report should contain a transcript, question-level rubric evidence, limitations and timestamped replay where alignment is available. Failed processing must remain visibly incomplete.

The corporate website may offer an interviewer-only overlay with an approved question-specific answer guide, acceptable alternative approaches and useful follow-up prompts. It describes what a good answer could cover; it does not evaluate a candidate as they speak. Human reviewers remain responsible for decisions. Age, demographics, prestige and unsupported claims must not influence evaluations.

Presage remains exploratory. Recording analysis support must be verified rather than inferred from availability of a live SDK. Do not promise that a post-interview service can process arbitrary videos until that capability is demonstrated.

## Development workbench

The branch adds `/dev` and `/api/dev/[operation]` to the existing Next.js App Router application. Both require development mode and Clerk authentication. Mutating endpoints also enforce same-origin requests. The page includes role and question exploration, local PDF/DOCX text extraction, an editable profile, project relevance explanations, curated template previews and unconnected integration panels.

PDF and DOCX uploads are limited to 10 MB; extraction does not provide OCR. Scanned or unreadable documents require pasted text. Uploads are processed in memory. Model submission is a separate explicit action. Profile review is required before ranking or export. Project ranking is a deterministic evidence-availability heuristic for selecting questions, not a candidate hiring score or validated assessment of project quality.

Gemini work was handed over from the second implementation task and resumed. The AI playground includes streaming practice chat, structured question packs and reports generated only after an answer is explicitly submitted. Streaming chat is a development assistant, not live interview analysis. Model configuration and credentials remain server-side. Backboard is intended to own user memory; corpus storage is reference data, not a competing memory store.

Future ElevenLabs speech and optional avatars attach to question presentation. Subtitles must offer small, medium, large and extra-large sizes, readable contrast and independently available text. Voice, avatars, subtitles and Presage remain integration slots; Gemini and Backboard have their own functional playground controls. No successful media session is implied.

## Research storage and import

Research content, source inventories, real resumes, generated profiles and credentials must stay out of Git. `GET_ME_HIRED_RESEARCH_DIR` identifies the external local corpus. Versioned JSON is schema-validated, checked for unique IDs and normalized prompts, checked for relationship integrity, and verified against manifest checksums. These checks do not establish psychometric validity or prove semantic independence of every question.

`pnpm import:research` validates the external dataset before connecting to `DATABASE_URL`. The importer uses a dedicated `gmh_research` schema, immutable versioned JSON documents and a single transaction. It compares read-back document hashes and revalidates the reconstructed corpus before committing. A differing existing version is rejected rather than overwritten. No candidate, account or existing application tables are modified.

`pnpm verify:research-db` compares the database version against the configured local manifest and reconstructs and validates all documents. A successful import is not proof of the full application workflow: authentication, UI, provider calls, media and report generation need their own checks.

Set `GET_ME_HIRED_RESEARCH_SOURCE=database` and `GET_ME_HIRED_RESEARCH_VERSION` to the imported version to use the server-side database reader. It validates document hashes, schemas and relationships on read. `GET_ME_HIRED_RESEARCH_DIR` can then point to the external archive for explicit exports and import verification. The database import and a separate round-trip verification succeeded on September 12, 2026; the application corpus reader also returned the validated dataset. The local corpus was archived outside Git, preserving the manifest and source attribution. Do not delete the only usable copy. Database authentication failure blocks import and archival cutover; it must never be reported as a successful migration.

## Verification status

Local focused tests cover extraction, malformed input, unknown fields, deterministic rankings, missing template fields and development/authentication guards. Browser sign-in has encountered a Clerk redirect loop, so authenticated end-to-end operation is not yet verified. Interview recording, playback reports and corporate overlays are product contracts, not delivered features of this workbench.

## AI playground implementation

`/api/dev/ai/[action]` provides status, connection checks, chat, questions, evaluate and memory operations. All routes share the development-only Clerk gate; writes enforce same-origin requests and a bounded request body. Gemini uses LangChain, the configured model and structured output with strict local Zod validation. Question packs preserve seed IDs and dataset versions; unavailable corpus data is explicitly labeled as a fallback. Generated excerpts and report evidence are checked against supplied text. Ratings without evidence are replaced with unknown; there is no candidate composite score.

The playground accepts a completed pasted answer to exercise post-submission reports. Recording, transcription alignment and video playback still require implementation. Reports and conversations remain temporary. Clearing the resume session also resets AI chat and retained retry context. Explicitly attaching a reviewed profile, target role or saved notes determines what is sent to Gemini.

Backboard stores only explicitly approved learning notes. List, search, save, edit, delete and reset controls are implemented. A local ignored ownership registry maps a hashed Clerk user identifier to a Backboard assistant; it contains no memory content and is not a competing memory service. Do not delete it while retaining remote notes. A production deployment needs a durable shared ownership registry and stronger distributed operation handling. Interrupted writes may need reconciliation; no blind write retries are performed. Crashed-process locks require local recovery.

Tests cover AI route access, origin rejection, unsupported evidence, malformed outputs and separate user ownership mappings. Provider smoke tests use synthetic text and do not save a resume or report. These checks do not establish quality of every generated question or hiring validity.

## Final integration checks — September 12, 2026

Lint, TypeScript, production build and 20 focused tests passed. A real Gemini smoke test generated two questions, evaluated a completed synthetic answer into five report dimensions and streamed chat successfully. A real Backboard smoke test verified save, edit, delete, reset and separate-user lookup; its temporary assistant was removed. Research database integrity and the application reader were verified separately. The authenticated browser path remains unverified because local Clerk navigation loops; do not treat server/provider tests as a browser acceptance pass.

Run `pnpm check:ai` and `pnpm check:memory` from `app/` to repeat the synthetic provider checks; these require valid keys and may incur provider usage. `pnpm check:corpus` validates the configured data source.

Resume parsing makes at most two provider attempts. Authentication, quota, unavailable-model and timeout failures stop immediately; only transient provider failures or invalid structured output receive one retry. Runtime diagnostics record the model, attempt, duration and failure category without logging resume contents. The server date is supplied to Gemini so date-related warnings are interpreted against the actual run date.

## Interview planning before speech integration

The backend path is extraction → LLM profile and experience classification → user correction → weighted interview plan → structured Gemini question pack → explicit answer submission → evidence-linked report → optional reviewed Backboard note. The parser assigns experience and explains its classification. An explicit target seniority overrides question difficulty; otherwise the corrected parsed level is used. Unknown experience remains unknown.

Each generation loads one validated corpus snapshot. Role family limits the candidate pool. Specialty, experience, optional technology and resume skills increase sampling weights. Sampling is without replacement, favors distinct scenarios and includes both interview categories where available. Each response contains the selection seed, dataset version, weighting factors, selected corpus IDs and project component scores. Reusing a seed reproduces selection for identical inputs, not Gemini wording. The playground supplies recently selected IDs to avoid repeat seed topics within that browser session; it does not create persistent memory. Exact semantic non-repetition of model-authored wording is not guaranteed.

Projects use role relevance, specialty technologies, explicit technology preferences, competency evidence, contribution, decisions and outcomes. Missing evidence remains separate from weak matches. A focus project is sampled among at most three documented projects within 15 score points of the strongest. Its named-project question must cite evidence from that project or the pack is rejected. This supports questions such as “Tell me about your work on [project] and the tradeoff you made,” without manufacturing a responsibility or result. Projects without evidence do not receive that guaranteed focus slot.

The model receives the full confirmed profile, target description, effective experience, selected question seeds, project explanations and optional approved Backboard notes. The combined context influences questions; no single universal candidate score determines the interview. Generation validates counts, category balance, project IDs, evidence and corpus provenance. Corpus failures are surfaced rather than silently losing the research context. The response is a speech-ready text question pack; ElevenLabs, video recording, transcription and timestamped playback remain separate integration work.

In the playground, reviewed profile and selected role context are enabled by default and can be deselected. `scripts/check-pipeline.ts` exercises parsing, experience propagation, named-project generation and submitted-answer reporting with synthetic data.
