# Practice experience

## Setup and resume understanding

**Confirmed flow:** upload resume → identify experience and individual projects → specify target role → generate appropriate questions → choose recorded or live practice → receive feedback.

**Proposed details:**

1. Accept a bounded set of resume formats, initially PDF and DOCX. Validate file type and size; treat scanned PDFs as unsupported until OCR is intentionally added.
2. Extract roles, projects, skills, dates, claimed responsibilities, and evidence snippets. Keep missing facts explicitly unknown.
3. Show the parsed profile for correction. An inferred experience level is editable, not an unquestionable label.
4. Ask for the target position and optionally a job description. Resume experience and target role jointly inform difficulty.
5. Choose behavioral, technical-behavioral, or a mixture; show estimated duration and question count.
6. Run a microphone/camera check and explain recording and report use before recording begins.

A candidate may omit a resume and enter a short structured profile as a proposed fallback. This should produce more general questions, with a clear explanation that personalization is limited.

## Recorded practice

The system presents one question at a time, in text and optionally ElevenLabs voice. The candidate records a response in the page or uploads an existing response for that question. Each answer has a review/replace step before final submission. Proposed practice defaults allow retrying; attempt history must distinguish retries rather than silently overwrite them.

Show microphone status, camera preview, recording indicator, elapsed time, upload progress and submission confirmation. If an upload fails, retry the same attempt using an idempotent upload flow. Preserve a recoverable local recording where browser support allows, and communicate when it cannot be preserved.

Recorded questions need not adapt mid-answer. A follow-up can be generated after submission, but the UI must make clear when it is an additional question.

## Live practice

The candidate joins a dedicated Zoom-like interview page inside Get Me Hired. The AI interviewer speaks, listens, and asks context-aware follow-ups. Text captions and a visible current question provide alternatives to voice. Optional avatars are presentation only and should not be required to participate.

**Proposed controls:** mute, camera toggle, pause, end, reconnect, and interviewer volume. Pausing practice stops questioning; it must make recording behavior explicit. Microphone capture must not accidentally transcribe the interviewer's own speech as the candidate's answer.

Live interaction requires a separate technical spike for latency, interruption, turn detection and streaming transcription. If that spike fails, ship recorded practice first and label live practice unavailable instead of simulating a live feature with undisclosed playback.

## Report and next session

After processing, show the transcript, answer replay, question-level feedback, rubric breakdown, strengths, improvement actions and suggested retry questions. Link evidence to timestamps when reliable alignment exists. Allow transcript corrections and record whether a report was regenerated after a correction.

Proposed repeat-practice context contains compact, candidate-approved learning notes rather than automatically forwarding every raw recording. A candidate can reset this context. Corporate reviewers must not see it.

## Acceptance scenarios

- A candidate corrects an incorrectly parsed role before questions are generated; the corrected profile is used.
- A project-specific question cites an actual resume project rather than inventing a project.
- A failed answer upload can retry without creating duplicate answer records.
- A silent or untranscribable answer is marked insufficient evidence, not scored zero for competence.
- A practice report is inaccessible using another user's session identifier.
