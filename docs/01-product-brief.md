# Product brief

## Vision

**Get Me Hired** helps CS candidates rehearse realistic video interviews and helps employers prepare, conduct, and review them. Both sides share question-generation and answer-evaluation components, but they have different workflows, permissions and reporting audiences.

The core value is contextual interviewing: questions and follow-ups should reflect a candidate's actual resume, individual projects, experience level and target position. Feedback should explain how an answer could improve, with evidence from what was said.

## Product boundaries

**Confirmed:** video interviews, behavioral questions, technical-behavioral questions, candidate practice, corporate screening, resume-informed personalization, recorded and live interactions, transcripts and reports, voice, and future context reuse.

Technical-behavioral means discussing technical work: explaining a design decision, debugging an incident, describing a tradeoff, communicating a technical idea, or reflecting on a project. The platform is not currently a live-coding environment. If coding is added later, record that as an explicit scope change.

## People and workspaces

| Actor | Needs | Access boundary |
| --- | --- | --- |
| Candidate practicing | Rehearse, review private feedback, improve over time | Own practice profile and sessions |
| Invited candidate | Complete an employer-defined interview | Own invitation and permitted candidate-facing results |
| Recruiter or HR owner | Configure a role, send screens, review evidence | Authorized organization and requisitions |
| Human interviewer | Prepare questions, see evaluation guidance, take notes | Assigned interviews |
| Workspace administrator | Manage membership and settings | Organization administration; media access still explicit |

**Confirmed:** corporate HR workflows must not operate through the candidate practice interface. **Proposed:** an individual may have separate personal and organization memberships, with an explicit workspace switch; neither workspace automatically inherits the other's data.

## Two independent choices

1. **Workspace:** Practice or Corporate.
2. **Interview format:** Recorded or Live.

An employer's automated recorded screen can resemble recorded practice without becoming practice or exposing private practice history. Corporate interviews may also be assisted human interviews.

## Success criteria

Proposed product measures: completed-session rate, time to usable feedback, candidate-rated usefulness, repeat practice use, rubric consistency on sample responses, and interviewer preparation time. Track media failures and transcript corrections alongside these measures.

Do not equate a higher practice score with guaranteed hiring success. Employer reports support human review; they do not automatically decide who gets hired.

## Context for future work

Reports should feed a candidate's authorized practice context so follow-up sessions can target weaknesses and avoid repetition. A possible custom model is exploratory. Product improvement, personal context reuse, and model training are separate purposes with separate data controls.
