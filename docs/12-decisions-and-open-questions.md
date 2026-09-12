# Decisions and open questions

## Confirmed product direction

| ID | Decision | Source/status |
| --- | --- | --- |
| D-001 | Product name is Get Me Hired | Founder, Sep 12, 2026 |
| D-002 | HackRice project, initially CS-oriented | Founder |
| D-003 | Exclusively video behavioral and technical-behavioral interviews | Founder |
| D-004 | Separate Practice and Corporate modes | Founder |
| D-005 | Recorded responses and live in-app interviews | Founder; full implementation pending |
| D-006 | Resume/experience/target-role personalization | Founder |
| D-007 | Transcription-driven reports with rankings and breakdowns | Founder; exact rubric unresolved |
| D-008 | HR can skip screening and generate interviewer questions/guidance | Founder |
| D-009 | ElevenLabs voice in both practice formats and automated corporate interviews | Founder; API approach unresolved |
| D-010 | Reports feed future context; possible custom model | Context confirmed; model exploratory |
| D-011 | Presage SmartSpectra service is being ideated | Founder; feasibility unresolved |
| D-012 | Optional uploaded avatar art packs | Founder; asset pipeline unresolved |

## Explicit proposals requiring team review

- P-001: recorded practice first, then minimal corporate flow, then live interaction.
- P-002: job-relevant, evidence-linked rubrics; age and camera/physiological observations excluded from hiring scores.
- P-003: corporate rubrics standardized by role; experience personalizes questions without scoring resume tenure itself.
- P-004: separate practice context, corporate records and opt-in future training data.
- P-005: composites withheld until required-evidence coverage rules are approved.
- P-006: initial application plus background worker, with vendor adapters.
- P-007: HR receives expected concepts and acceptable alternatives rather than a single absolute optimal answer.

## Questions to resolve

| Priority | Question | Why it matters |
| --- | --- | --- |
| Before coding reconciliation | What stack and repository structure does the first push establish? | Avoid conflicting scaffolds |
| Before AI integration | How are Backboard, Gemini and LangChain divided? | One canonical context and execution path |
| Before media pipeline | Which transcription service and supported languages? | Timing, speaker attribution, latency and cost |
| Before live mode | AI-only, human-to-human, or both for the first live release? | Transport and room complexity |
| Before MVP freeze | Which integrations are required for HackRice/sponsor judging? | Prioritization |
| Before scoring | Which competencies, anchors, weights and coverage threshold? | Defensible, consistent reports |
| Before corporate launch | Who can see candidate reports and can candidates receive them? | Access and expectation setting |
| Before invitations | Recorded-only screens first or also live automated screens? | Delivery scope |
| Before SDK service | What precisely should Presage provide, and on which runtime? | Feasibility and interpretation |
| Before Persona work | Which Persona product and what purpose? | Avoid inventing an identity/avatar dependency |
| Before data collection | Recording retention, deletion, processing regions and context defaults? | Data lifecycle |
| Before art upload | Art formats, animation behavior and licensed ownership? | Renderer and asset handling |
| Later | Which external conferencing platform first? | Separate bot integration design |

## Decision template

For each new decision record: ID, date, status, owner, problem, selected option, alternatives, consequences, verification evidence and linked implementation. Mark superseded entries; do not erase the reasoning behind a previous version.
