# Live interviewer voice and live follow-ups

## Current status — September 12, 2026

TTS, browser captions and Gemini interview routes are implemented in main. The workbench speech plan is separate. Old statements about missing local keys describe that checkpoint, not a current account-status check. This audit did not call ElevenLabs. Captions/live follow-up prompts do not constitute live scoring or candidate feedback. See [current codebase](14-current-codebase.md).

## Historical design / checkpoint

## Status

Built. Supersedes the "ElevenLabs voice (questions are shown as text for
now)" line that used to be in
[16-camera-recorder-build-slice.md](./16-camera-recorder-build-slice.md)'s
out-of-scope list. Goal: the interviewer speaks each question aloud, and
can ask one live follow-up per question if the candidate's answer
warrants it, then moves on — a single question, one possible follow-up,
then stop, matching the founder's stated scope (not a continuous
back-and-forth conversation).

## Pieces

- `POST /api/interview/speak` (`app/src/app/api/interview/speak/route.ts`)
  — calls ElevenLabs TTS with `ELEVENLABS_API_KEY`, streams back
  `audio/mpeg`. **Blocked on a real API key** — see "Open blocker" below.
- `useTextToSpeech` (`app/src/hooks/useTextToSpeech.ts`) — fetches that
  route, plays the resulting audio, exposes `isSpeaking`. Browser-only,
  validated by hand once a key exists, not unit-tested (same testability
  boundary as `useCameraRecorder`, see
  [17-camera-recorder-component.md](./17-camera-recorder-component.md)).
- `useLiveCaptions` (`app/src/hooks/useLiveCaptions.ts`) — wraps the Web
  Speech API (`SpeechRecognition`/`webkitSpeechRecognition`) for live
  transcription of the candidate's answer. Chrome/Edge only; no
  browser-neutral equivalent exists. `start()` resets and begins listening
  fresh each question.
- `src/lib/follow-up/*` (already existed) — `buildFollowUpPrompt`,
  `parseFollowUpResponse`, `shouldRequestFollowUp`, all Vitest-tested.
- `POST /api/interview/follow-up` (already existed) — now confirmed
  working end to end against the real Gemini API.
- Wiring lives in `CameraRecorder.tsx`: speaks `questionPrompt` when it
  changes, watches `useLiveCaptions` output on a 500ms interval while
  recording, requests a follow-up at most once per question via
  `shouldRequestFollowUp`, and speaks the follow-up if one comes back.

## What was actually verified against live services

- Gemini follow-up route: confirmed correct end to end (not just unit
  tests) — the model's raw response shape, this repo's JSON extraction,
  and `parseFollowUpResponse` all agree, using a transcript that plausibly
  warrants a follow-up.
- **Model name changed under us mid-build**: `gemini-2.5-flash` now
  returns `404 "no longer available to new users"` on the key in use;
  swapped to `gemini-3.6-flash`, confirmed working.
- **`thinkingConfig.thinkingBudget: 0` is rejected** by `gemini-3.6-flash`
  (`400 INVALID_ARGUMENT`) — this model apparently doesn't support fully
  disabling thinking. `thinkingBudget: 128` is the smallest value
  confirmed to work, cutting `thoughtsTokenCount` roughly 3-4x versus the
  model's default (uncapped) thinking. Thinking mode's default latency is
  multiple seconds, unacceptable for something that has to happen during
  a live pause in an interview answer; 128 is a real, verified compromise,
  not a guess.
- **Free-tier Gemini rate limit is tight**: hit `429` at 5 requests in a
  short window during manual testing. The follow-up route already
  degrades to `{"followUp": null}` on any failure (bad response, timeout,
  429, whatever) — by design, since a missed follow-up should never break
  the interview. Worth knowing before a live demo: rapid-fire testing (or
  a live audience Q&A) can exhaust a free-tier key mid-demo.

## Open blocker: ElevenLabs API key

No `ELEVENLABS_API_KEY` exists anywhere in this environment (checked
`.env.local`, shell env, and for an ElevenLabs CLI/MCP tool — none
found). Unlike TigerData or Clerk, there's no way to provision this key
programmatically here; it needs to come from whoever owns (or will
create) an ElevenLabs account. Everything up to the actual network call
is built and will work the moment `ELEVENLABS_API_KEY` (and optionally
`ELEVENLABS_VOICE_ID`, defaults to the premade "Rachel" voice) lands in
`.env.local` — no code changes needed.

## Unrelated bug fixed while verifying this

`.env.local`'s `CLERK_SECRET_KEY` had been mistyped as
`CxcLERK_SECRET_KEY` (from a manual edit, unrelated to this feature),
which broke every route in the app with a 500. Fixed. Worth a general
reminder: hand-editing `.env.local` is easy to typo silently, since
there's no schema check — a stray extra character in a variable name
fails open (Next.js just treats it as unset) rather than erroring
immediately at the edit site.
