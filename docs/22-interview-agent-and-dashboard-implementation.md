# Interview agent and dashboard implementation brief

**Status:** discovery draft — decisions marked **Open** need founder/team input.

## 1. The outcome

Get Me Hired should run a credible, adaptive practice interview: an interviewer
sets expectations, asks role-specific questions, listens without cutting the
candidate off, follows up only when useful, handles reasonable requests for
clarification, and finishes with a reviewable recording and feedback report.

The product should feel like an interview, not a video call wearing an AI skin.
The dashboard should make the next useful action obvious: start practice,
resume a session, or revisit feedback. It should not advertise features that
do nothing.

### MVP success criteria

1. A candidate can configure, start, complete, and resume a session without
   losing questions, transcripts, or recordings.
2. The interviewer can make a context-aware next-turn decision from a durable
   transcript and interview plan: ask, clarify, probe, acknowledge, or close.
3. Every question has a clear end-of-answer mechanism that is under the
   candidate's control; silence detection is assistance, not the sole control.
4. A completed session produces a useful, transparent report. The candidate
   can play recordings and see the evidence behind feedback.
5. The dashboard reflects genuine stored state and has no dead controls.

## 2. What is already implemented

| Capability | Current behavior | Gap before agent MVP |
| --- | --- | --- |
| Setup | Technical/behavioral mode, 1–5 questions, voice, mood and optional focus prompt | No target role, level, company/job description, resume context, accessibility or practice goal |
| Questions | Gemini can create the opening question and later questions using prior answer text; static questions are fallback | Questions are not persisted as a session plan; resumed sessions use a static pack instead of the original generated questions |
| Voice | ElevenLabs route and browser player exist | Actual voice depends on an API key; turn behavior does not handle barge-in or voice failures visibly |
| Transcription | Browser Web Speech captions while recording | Chrome/Edge only; transcript is not reliably stored as the authoritative artifact |
| Follow-up | After a substantial answer and 5s silence, Gemini may ask one follow-up | One opaque heuristic, no tool/decision trace, no candidate “I’m done” action, no natural multi-turn policy |
| Recording | Camera/mic recording and R2 upload exist | Upload failures are not recoverable from the dashboard; playback/report linkage is unfinished |
| Sessions | Session state, count, mood, focus and voice persist; recent sessions/resume display on home | No session detail/report page and no interview event timeline |
| Dashboard | Start, resume and basic session counts work | It lacks goals, reports, playback, meaningful trends and a purposeful empty state |

### Existing UI elements to remove or defer

The active interview header shows **Participants**, **Chat**, **More options**
and **Share screen**. They presently do not perform an interview task. Remove
them from the practice MVP rather than mimicking conferencing software. Keep
camera/mic toggles and Leave, but make their consequences explicit. The
interview should add only controls that serve a candidate: **repeat question**,
**pause**, **finish answer**, **end session**, and optionally **text-only
fallback**.

## 3. Product decisions that shape the architecture

These decisions must be made before choosing a real-time provider or writing
an autonomous loop.

| Decision | Recommended initial answer | Why |
| --- | --- | --- |
| First audience | Authenticated practice users | Constrains consent, data ownership and speed of iteration |
| First format | Video + recorded answer + visible live transcript | Delivers the existing product promise while retaining an inspectable record |
| Turn control | Candidate presses “Finish answer”; silence only offers a gentle prompt | Prevents accidental cutoffs and makes the system accessible |
| Agent autonomy | Bounded: one planned question + 0–2 probes; candidate can request repeat/clarification | Keeps interviews fair, testable and cost-bounded |
| Question plan | Generate and persist the complete outline before the interview starts | Enables reliable resume, coverage and deterministic evaluation |
| Feedback | Asynchronous after completion | Avoids live scoring pressure and keeps the conversation responsive |
| Scoring | Evidence-based rubric per competency; confidence/coverage displayed | Avoids a black-box “hireability” score |
| Unsupported browser | Warn before lobby; offer recording/text fallback or block clearly | Web Speech is not cross-browser |

## 4. The interviewer as a bounded agent

Calling the interviewer an agent should not mean giving a model unlimited
authority. It should mean the model can choose its **next permitted interview
action**, with a server-enforced contract and complete trace.

### Agent inputs

- candidate profile selected for this session (role, level, goals, opted-in
  resume/context)
- immutable interview plan (competencies, question sequence, time budget,
  difficulty, expected evidence)
- structured conversation history (question, candidate transcript, event
  times, completed probes) rather than an ever-growing raw prompt
- current turn state and user intent (for example, `repeat_question`,
  `clarify`, `finish_answer`, `technical_failure`)
- policy configuration: practice/corporate mode, tone, maximum probes,
  prohibited behavior, language, accessibility settings

### Only permitted actions

```text
ASK_PLANNED_QUESTION(questionId, wording)
ASK_FOLLOW_UP(reason, wording)
ANSWER_CLARIFICATION(answer)
REPEAT_OR_REPHRASE(wording)
ACKNOWLEDGE_AND_WAIT()
MOVE_TO_NEXT_QUESTION(reason)
PAUSE_OR_RESUME(message)
CLOSE_INTERVIEW(summary)
ESCALATE_TO_FALLBACK(message)
```

The API validates the action against session state. For example, it rejects a
third probe, an unknown question ID, a new score during the interview, and a
follow-up when the candidate asked to finish.

### State machine

```text
setup → planned → lobby → interviewer_speaking → candidate_answering
                                      ↑               │
                                      └─ clarification ┤
                                                      ├→ agent_deciding
                                                      │       ├→ follow_up → interviewer_speaking
                                                      │       ├→ next_question → interviewer_speaking
                                                      │       └→ complete → processing → report_ready
                                                      └→ paused / abandoned / failed_recoverably
```

Events transition state; model text never does so by itself. A client may show
optimistic UI, but the server owns the authoritative state and sequence number.

### Recommended turn policy

1. Speak/display the question, then wait for completion of TTS.
2. Candidate answers; captions stream locally for immediate accessibility.
3. Candidate chooses **Finish answer**. After a configurable period of silence,
   UI may show “Finished answering?” with Finish/Keep speaking—never silently
   finalizes a response solely because of silence.
4. Server transcribes the finalized recording or accepts the captured text,
   appends an immutable turn event, and invokes `decideNextTurn`.
5. Agent returns validated JSON. If it asks a probe, record why (missing
   evidence, ambiguity, requested detail); otherwise move forward.
6. The same process repeats until the plan/time cap is complete.
7. The interview ends with no scores spoken aloud. Send artifacts to the
   asynchronous report pipeline.

### Prompt design rules

- Tell the model its role, scope, plan, time/probe limits, tone and action
  schema. Do not ask it to judge personality, appearance, accent, age,
  disability or demographic traits.
- Separate the interviewer prompt from the evaluator prompt. The interviewer
  should not see or disclose a numeric score during the interview.
- Provide retrieved candidate/job context only when consented to and relevant.
- Require concise spoken language; render longer explanations as text instead.
- Have deterministic fallback wording for model timeout, malformed output and
  provider rate limits.

## 5. Data model and artifacts

Add an append-only event trail; keep derived views for fast UI queries.

```text
interview_sessions
  id, user_id, mode, status, configuration_json, plan_version,
  started_at, ended_at, consent_version

interview_question_plans
  id, session_id, position, competency_id, base_question, intent,
  expected_evidence_json, max_probes, status

interview_turns
  id, session_id, plan_question_id, kind(question|answer|probe|system),
  parent_turn_id, sequence, text, transcript_status, started_at, ended_at

media_artifacts
  id, turn_id, r2_key, media_type, duration_ms, checksum, upload_status,
  transcription_status, retention_expires_at

agent_decisions
  id, session_id, after_turn_id, action, rationale_code, model, prompt_version,
  latency_ms, input_tokens, output_tokens, validation_status

evaluation_reports / evaluation_items
  session_id, version, status, generated_at, rubric_version,
  competency_id, evidence_turn_ids, finding, improvement, score, confidence
```

Do not store raw keys, model prompts containing secrets, or biometric inferences.
Use IDs/foreign keys, row-level user ownership checks, retention/delete jobs and
auditable report versioning.

## 6. API and real-time contract

Use server actions only for small authenticated mutations. Use route handlers
for interview event ingestion and agent responses. Add idempotency keys and
monotonic `sequence` values so refreshes/retries cannot duplicate a turn.

| Endpoint/event | Responsibility |
| --- | --- |
| `POST /api/interviews` | Validate setup, create session and persisted question plan |
| `POST /api/interviews/:id/join` | Confirm consent/browser capability and issue short-lived upload credentials |
| `POST /api/interviews/:id/events` | Append validated candidate/system events using idempotency key |
| `POST /api/interviews/:id/turns/:turnId/finalize` | Finalize transcript/media and invoke the decision service |
| `GET /api/interviews/:id/state` | Return resumable state, plan, current turn and safe event history |
| `POST /api/interviews/:id/pause` / `resume` / `end` | Explicit candidate controls |
| `POST /api/interviews/:id/report` | Queue evaluation after authorization and completion |
| `GET /api/reports/:sessionId` | Return a report only to an authorized owner/viewer |

For MVP, request/response HTTP plus polling works. If spoken interruption and
low-latency partial transcription are a top priority, adopt a managed realtime
transport later, behind a `ConversationTransport` adapter. Do not couple UI to
a single transcription/TTS/model vendor.

## 7. Dashboard redesign: information architecture

The home dashboard should be a calm practice command center, not a stats wall.

### Keep

- one high-emphasis “Start practice” action
- resume card only when a session is actually resumable
- recent sessions with clear status and a functional destination
- small progress summary, based on real completed/report data

### Add when data exists

- **Continue practicing:** a recommended next drill based on the latest
  report—not fake gamification
- **Latest feedback:** one concise card linking to a report; no score until the
  rubric is approved
- **Practice history:** sessions with report status, duration, role/focus and
  playback/report actions
- **Empty state:** explain the first session in three concrete steps and show
  privacy/camera expectations

### Remove now

- decorative progress metrics that do not change what a candidate should do
- conferencing controls that are unimplemented
- status pills that duplicate the only meaningful action, if space is tight
- vague setup copy such as “interviewer you want” when the actual choices are
  voice and tone

### Design direction

Retain the dark, focused product feel but make hierarchy warmer and less
generic: strong display typography, a narrow reading measure, one restrained
blue accent, real empty/loading/error states and keyboard-visible focus. Keep
the dashboard top-level navigation light; this product currently does not need
a permanent analytics sidebar. Verify every interaction at 320px and 1440px.

## 8. Implementation phases

### Phase 0 — decisions and instrumentation (0.5–1 day)

- Resolve the questions in section 11, define the MVP acceptance test and name
  a rubric owner.
- Add product telemetry with no transcript content: join rate, TTS failure,
  transcription fallback, finalized answer, latency, completion and report
  availability.
- Configure the real TTS key or select an alternative; test rate-limit and
  provider-outage fallbacks.

### Phase 1 — reliable session foundation (1–2 days)

- Persist the generated plan/questions at session creation and use it on resume.
- Add event/turn/media tables, migrations, ownership checks and idempotency.
- Replace auto-finish-on-silence with Finish answer / Keep answering controls.
- Make uploads recoverable and represent their state in session detail.

### Phase 2 — agent orchestrator (2–3 days)

- Implement schema-validated `decideNextTurn` server service and bounded tool
  policy.
- Add repeat/rephrase, clarification, pause, retry and safe failure UX.
- Persist agent actions/rationale codes, latency and prompt/model versions.
- Test deterministic policy checks separately from model behavior.

### Phase 3 — report and dashboard (2–3 days)

- Final transcription, queued evaluation, evidence-linked report and playback.
- Add report-aware dashboard cards/history; remove dead meeting controls.
- Build composed empty/loading/error states, mobile layout and accessible
  keyboard controls.

### Phase 4 — quality and demo hardening (1–2 days)

- Unit, integration and browser tests for state transitions, resume, retries,
  ownership and provider failure.
- Manual device/browser matrix; evaluate a curated answer corpus for follow-up
  quality, fairness, latency and failure recovery.
- Write demo script and seed an honest demo account only if the team agrees.

## 9. Definition of done and tests

### Functional acceptance checks

- Refresh at every state; session resumes at the same plan question and does
  not duplicate recordings or questions.
- Finish answer works with a silent microphone, failed transcription, TTS
  timeout, network retry and browser speech-recognition absence.
- A candidate can ask for a repeat/rephrase and get a bounded answer.
- The agent never asks more probes than policy permits, loops on a probe or
  exposes evaluation language during the interview.
- The dashboard has no actionable-looking element without a working outcome.
- A user cannot retrieve another user’s session, media or report.

### Metrics to capture before calling it successful

- setup-to-join conversion; join-to-complete conversion
- median/p95 question-to-listening and answer-finalize-to-next-turn latency
- transcription/TTS/model failure rate and recovery rate
- number of forced manual “Finish answer” actions vs silence suggestions
- report completion time and evidence coverage per competency
- qualitative ratings from at least five test users: realism, control,
  usefulness and perceived fairness

## 10. Risks and non-negotiables

- Video/audio/transcripts are sensitive. Obtain clear consent before capture,
  state retention plainly and provide deletion/export paths before any public
  release.
- Do not score facial expression, eye contact, voice/accent, emotion, age,
  gender, disability or other inferred traits for hiring. Do not present a
  practice score as employment eligibility.
- Models hallucinate and vendor APIs fail. A deterministic fallback must move
  the interview forward safely, with a visible retry/continue path.
- Browser speech recognition is an enhancement, not a persistence layer.
  Final report transcription needs a chosen, server-side source of truth.
- Model cost and latency rise with raw transcript context. Summarize older
  turns and retain structured evidence; never silently drop information that
  changes an agent decision.

## 11. Founder/team questionnaire

Answer in any format—short bullets, voice-dictated fragments, or direct edits
under each question are all useful. “Not sure” is a valid answer. Questions
are deliberately broad so we can turn the ideas into decisions rather than
assumptions.

### A. Product promise and audience

1. In one sentence, what should a candidate say this product did better than
   mock interviewing with a friend or ChatGPT?
2. Is this a practice coach, a hiring-screening tool, or both? Which is first?
3. Who is the initial user: student, new grad, career switcher, experienced
   engineer, recruiter, university program or company HR team?
4. Are technical questions coding-free technical-behavioral prompts, live
   coding, system design, or a mix?
5. What role families and seniority levels must be credible at HackRice?
6. Is the first release English-only? Which accents/languages matter next?
7. What differentiates practice from corporate mode in behavior, data access,
   tone, scoring and reporting?
8. What must be demo-ready versus merely shown as a roadmap?

### B. Ideal interview experience

9. Walk through the ideal first 90 seconds, word-for-word if you can.
10. Should the interviewer introduce itself, explain the format and ask for
   consent every session?
11. Should candidates see the question text while it is spoken? Always, on
   demand, or never?
12. What should happen when a candidate says “Can you repeat that?”, “What do
   you mean?”, “Can I have a moment?”, or “I’m done”?
13. Should candidates be allowed to pause, restart an answer, skip, extend
   time, or end early? Which of those must be saved?
14. How long should a session be and how many questions per type/level?
15. How many follow-ups feel helpful before the experience feels adversarial?
16. Should the agent follow a strict script, adapt questions freely, or adapt
   only its probes/rephrases while retaining a planned backbone?
17. What interviewer personalities should exist beyond the current
   supportive/neutral/direct tones? Are these truly useful or visual novelty?
18. Should the interviewer ever give encouragement during the interview? What
   phrases would feel authentic versus patronizing?
19. Should the candidate ever type instead of speak? Is a no-camera mode
   required?
20. Do you want captions and a transcript visible live, hidden, or selectable?

### C. Agent intelligence and boundaries

21. What information may personalize a question: role, job description,
   resume, GitHub, prior reports, employer, previous answers, target company?
22. What information must never affect questions or feedback?
23. Which exact candidate intents must the agent handle at MVP?
24. Is one follow-up per question enough? If not, what is the absolute cap?
25. What makes a follow-up good: missing metric, vague claim, technical depth,
   contradiction, ownership, tradeoff, reflection, or something else?
26. Should the agent be able to challenge an answer? Under what tone and guardrails?
27. Can it change the next planned question based on an answer, or only adjust
   wording/difficulty?
28. If the model fails or takes too long, should we use a fixed prompt, skip
   the probe, or visibly pause and retry?
29. How transparent should it be about being AI and about why it asked a
   follow-up?
30. Do you want the agent to remember previous sessions? If yes, what is the
   consent setting and can users inspect/delete that memory?

### D. Feedback and evaluation

31. At completion, what are the three most valuable outputs a candidate should
   receive?
32. Do you want a score at all? If yes, name it and define what a high score
   proves—not just its range.
33. Which competencies matter for behavioral interviews? Which for technical?
34. Who writes/approves the rubric and acceptable evidence examples?
35. What feedback must cite an exact transcript/recording moment?
36. Should feedback be immediate, after processing, or delivered by email too?
37. Can candidates challenge/correct a transcript or score?
38. Can reports compare sessions over time? What data makes that comparison fair?
39. What should never appear in feedback (filler words, voice traits, facial
   behavior, confidence judgments, etc.)?
40. What report would make a recruiter/mentor trust it rather than dismiss it?

### E. Data, privacy and trust

41. Is camera mandatory, optional or default-on? Why?
42. Are recordings retained forever, for a fixed time, until deletion, or only
   locally until a report is made?
43. Who can access recordings/transcripts/reports in practice vs corporate?
44. Do candidates need deletion, export and consent withdrawal at MVP?
45. Where will data be processed/stored, and are there any university/company
   requirements?
46. May de-identified sessions improve prompts/models? Is opt-in required?
47. What should the lobby say plainly about recording, transcription, AI and
   the limits of feedback?
48. Are there legal/accessibility advisors or policy constraints we must honor?

### F. Dashboard and UI

49. When a user returns, what one action should the page make easiest?
50. Is the dashboard for practice users only, or must it support recruiters,
   mentors and candidates with different home pages?
51. What should a first-time user understand in under ten seconds?
52. Which current dashboard facts are meaningful: total sessions, completed,
   this week, streak, time practiced, report trend, next recommendation?
53. What would make someone return tomorrow rather than stop after one session?
54. Should history expose recordings, transcripts, reports, configurations,
   replay, duplicate/try-again, delete—or all of these?
55. What visual direction fits Get Me Hired: calm coach, serious recruiter,
   student-friendly studio, technical workbench, or another reference?
56. Are there brand colors, logo/font references, screenshots or products you
   want us to borrow cues from (not copy)?
57. Which controls currently feel cluttered or fake to you beyond the meeting
   toolbar? Which elements must stay?
58. Mobile first, desktop first, or equal priority? What is the demo device?

### G. Delivery and operations

59. What provider credentials/budget are available for TTS, transcription,
   LLMs, media storage and background jobs?
60. Is a real ElevenLabs key available? If not, should the demo use browser
   speech or a different provider?
61. What latency is acceptable between “Finish answer” and the next prompt?
62. What happens when a free-tier rate limit hits during a demo?
63. Who owns product calls, UX approval, evaluation rubric and deployment?
64. What is the deadline, team capacity and exact judging rubric?
65. Which test participants can give feedback before demo day?
66. Which analytics are acceptable, and where should they be visible?

## 12. Immediate next decisions

Reply first to 1, 2, 4, 12–16, 21, 24, 31–35, 41–44, 49–50, 54–58 and
59–64. Those answers unlock a focused first implementation slice. The rest
can follow as the product gets sharper.
