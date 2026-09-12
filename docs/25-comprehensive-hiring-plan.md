# Comprehensive plan — Get Me Hired (HackRice 2026)

**Branch:** `solana`  
**Last updated:** September 12, 2026  
**Audience:** Hasna + friend running deploy/demo
**Principle:** Practice mode stays untouched. Hiring builds on shared AI/resume plumbing behind explicit boundaries.
**Demo principle:** Judges see a self-serve flow. You type fresh inputs live and start a real session yourself — no hardcoded org, job, email, resume, or questions. `demo-seed` is fallback only, never the main narrative.

---

## 0. North star

Deliver one **honest, end-to-end employer-directed recorded interview** where:

1. HR configures a **template** (personality/behavioral vs technical-behavioral vs mixed).
2. **Resume parsing** drives which questions are selected and personalized.
3. Candidate completes **Persona verification** → **record-yourself interview** → async processing.
4. HR reviews with a **private answer guide overlay** (listen-for indicators, rubric anchors).
5. Report shows **per-question dimensions** and an **optional composite index** only when evidence coverage is sufficient.
6. **Solana devnet** stores opaque commitments (invitation, identity, report release) — not hiring decisions.
7. **Self-serve demo:** all inputs (org, job, candidate, resume, template) are entered live in the UI. Nothing is hardcoded.

### 0b. What "nothing hardcoded" means (judge test)

A judge should be able to say "use my name and my project" and you can do it without touching code or DB. That means removing these current hardcodings in `lib/hiring/demo-seed.ts`:

| Hardcoded today | Why it kills the demo | Replacement |
| --- | --- | --- |
| `DEMO_ORG_CLERK_ID = "demo-hackathon-org"` | Every demo reuses one org; stale state leaks between runs | Org comes from your signed-in Clerk org, or a `Demo org name` input that creates a fresh org row |
| Job title `'Software Engineer (Demo)'` | Can't tailor to judge ("Product Designer", "SWE Intern") | `Job title + role_family + description` inputs on `/demo/start` |
| Emails `demo.candidate@example.com`, `candidate-invite-demo@example.com` | Invite/verify links point at fake inboxes; can't use judge's email | `Candidate name + email` inputs; invite URL built from `window.location.origin`, never `NEXT_PUBLIC_APP_URL` fallback alone |
| `demoQuestions("Get Me Hired interview platform")` | Questions ignore the uploaded resume — judges spot this instantly | Real `generateCandidateQuestions()` from uploaded/parsed resume; hardcoded pack kept only as offline fallback labeled "fallback pack" |
| `resumeFacts` static object | Same skills/projects every run | Resume upload → parse → `structured_facts`; plus 1-click "use sample resume" that still flows through the parser |
| `ensureCandidacy` reuse-by-email + `demo-verified` bypass | Second run silently reuses session 1; verification step is faked | `Start fresh session` button creates new `candidacy + pack + invitation` rows every click; verification is real Persona sandbox (fast-track = sandbox pass, not DB fake) |
| `NEXT_PUBLIC_APP_URL ?? localhost` in `/dev/hiring-links` | Links break on Vercel/tunnel | All invite links built from request origin at runtime |

---

## 1. Current baseline (verified today)

### Done and real

| Area | Status | Evidence |
| --- | --- | --- |
| Hiring DB schema | Applied locally (`0008`) | Tables present on `:5434/hackrice` |
| Persona sandbox | Live | Inquiry API 201, webhook HMAC, events enabled |
| Persona candidate UI | Live | Hosted verify URL + status polling |
| Solana outbox | Real devnet memo txs | `verify:solana` pass, Solscan signature |
| Worker | Live | Auth + batch processing |
| Static gate | Pass | 137 tests, build, tsc |
| Demo links | Live | `/dev/hiring-links` seeds real UUIDs — **to be replaced by `/demo/start` self-serve launcher (Phase A0)** |
| Question generation (basic) | Partial | Resume → Gemini pack; behavioral + technical-behavioral mix |
| Practice interviews | **Untouched** | Separate `session_mode`, no hiring regressions |

### Not done / gaps

| Gap | Impact |
| --- | --- |
| Full browser E2E (HR → candidate → record → report) | Demo risk |
| HR template picker | Can't choose personality-only vs technical-only |
| Expected-answer overlay on HR report | Docs promise it; not in hiring UI |
| Composite score for hiring | Docs propose formula; not implemented |
| Approved pack strips rich metadata | `strongAnswerIndicators`, `intent`, follow-ups lost at approval |
| Anchor program on-chain | App uses Memo txs; program compiles but isn't invoked |
| Production DB (TigerData) | Local Postgres only from dev machine |
| Tunnel ops documented in runbook | cloudflared required for Persona webhooks |

---

## 2. Architecture boundaries (do not blur)

```
┌─────────────────────────────────────────────────────────────┐
│  PRACTICE (unchanged)                                       │
│  /interview/setup → session_mode=practice                   │
│  Workbench AI, memory, no composite score, no Persona       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  HIRING (solana branch)                                     │
│  /hr → candidacy → pack → invite → Persona → recorded room  │
│  session_mode=hiring_recorded, frozen plan, no live follow-ups│
│  Async: Scribe → evaluation → report → optional release     │
└─────────────────────────────────────────────────────────────┘

         Shared (read-only reuse):
         • generateQuestions() / evaluateAnswer() in workbench AI
         • Resume structured_facts schema
         • CameraRecorder component (different policy wrapper)
         • R2 upload, processing worker patterns
```

**Rule:** Never import hiring-only modules from practice routes. Shared logic lives in `lib/workbench/` and `lib/interviews/` with mode passed explicitly.

---

## 3. Phase plan

### Phase A0 — Self-serve demo launcher (do FIRST, ~0.5–1 day, blocks perfect demo)

**Goal:** You start a fresh session yourself, live, with zero hardcoding. This is the highest-priority build — before templates/overlay/composite.

Build a single page `/demo/start` (signed-in, `HIRING_ENABLED=true`) that runs the whole HR setup in one place:

```
Step 1 — Where:  [Org: ▾ your Clerk orgs] or [+ new demo org: "Acme ___"]
Step 2 — Role:   [Job title: "___"] [Role family: ▾] [Description: ___]
Step 3 — Who:    [Candidate name: "___"] [Candidate email: "___"]
Step 4 — Resume: [Upload PDF] or [Use sample resume] → shows parsed skills/projects preview
Step 5 — Format: ( ) Balanced  ( ) Personality/Behavioral  ( ) Technical-Behavioral
Step 6 — [Generate questions] → editable list → [Approve] → [Issue invitation]
Result:  Invite link:  <copy>   Verify link: <copy>   Interview link: appears after verify
         [Open candidate view]  [Reset demo (archive this candidacy)]
```

Behavioral contract (nothing hardcoded):

- Every click on `Start fresh session` inserts **new** `organization (if new) → hiring_job → candidacy → hiring_resume → approved_question_pack → invitation` rows. Never `SELECT … WHERE email=X` reuse. Old runs are left `superseded`/`revoked`, never mutated.
- Question generation calls the real `generateCandidateQuestions()` with the live resume + template filter. If Gemini errors/timeouts, show banner "AI unavailable — fallback pack from resume keywords" and use a resume-keyword-templated fallback (project name injected from parsed facts, not a constant). Label it visibly so judges trust it.
- Invite/verify URLs use the request origin at action time (`window.location.origin` passed as `appOrigin`), never a baked `NEXT_PUBLIC_APP_URL`.
- Verification is **real Persona sandbox**: create inquiry via `createPersonaInquiry()`, poll status, webhook flips `verified`. No `demo-verified` DB insert on the happy path. Provide a `Mark sandbox-passed (fast-track)` button only as backup, labeled as sandbox.
- Interview session is created from the approved pack (frozen plan, `session_mode=hiring_recorded`), not pre-seeded. Recording → worker → report is the same async path as production.
- `Reset demo` sets candidacy to `revoked`/`deleted` and clears the form so the next judge gets a clean slate in <10s.

Keep `/dev/hiring-links` as engineering fallback, but the judge narrative starts at `/demo/start`.

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| A0.1 | `/demo/start` form + actions (org/job/candidate/resume/template in one flow) | You | Fresh name+email+job → new candidacy + invite link, no code edit |
| A0.2 | Resume upload → parse → preview (reuse `uploadHiringResume`); sample-resume path still runs parser | You | Judge's project name appears in ≥1 generated question |
| A0.3 | Template filter wired (post-filter, no shared-schema change — see B3) | You | Personality-only run yields 0 `technical-behavioral` |
| A0.4 | Fresh-session + reset semantics (no reuse-by-email, revoke old invites) | You | Clicking Start twice yields 2 active candidacies; Reset revokes |
| A0.5 | Origin-safe links + labeled fallback pack + sandbox fast-track button | You | Works on localhost, tunnel, and Vercel without env edit |

**Exit:** You can run the full judge script (section 6) twice in a row with different names/emails/jobs and get two independent, correct sessions.

### Phase A — Demo hardening (1–2 days, friend can run)

**Goal:** Persona reps + judges can click through without placeholders or 500s.

| # | Task | Owner | Done when |
| --- | --- | --- | --- |
| A1 | Runbook: cloudflared + `setup:persona-webhook` | Friend | Webhook delivers on inquiry complete |
| A2 | One live E2E script/checklist (use `/demo/start`, not `/dev/hiring-links`) | Friend | HR invite → Persona → 1 recorded answer → report row exists |
| A3 | Keep `/dev/hiring-links` as engineering fallback only; judges start at `/demo/start` | Done / you | `/demo/start` is the demo entry; dev-links never shown on stage |
| A4 | Apply `0008` to TigerData when network allows | Friend | Remote `DATABASE_URL` works |
| A5 | R2 CORS if uploads fail | Friend | Recording reaches `uploaded` |
| A6 | Fund Solana wallet before demo | Done | ≥0.1 SOL on service keypair |

**Exit:** Demo narrative works once through without manual DB edits.

---

### Phase B — HR interview templates (3–5 days)

**Goal:** HR chooses interview type before question generation.

#### B1 — Template model

Add `interview_template` on job or candidacy:

| Template ID | Label | Question mix | Generator constraint |
| --- | --- | --- | --- |
| `personality_behavioral` | Personality / Behavioral | 100% behavioral | `category=behavioral` only |
| `technical_behavioral` | Technical Behavioral | 100% technical-behavioral | `category=technical-behavioral` only |
| `balanced` | Balanced screen | 50/50 (default) | Current behavior |
| `custom` | Custom | HR edits after generate | No auto constraint |

Store on `hiring_jobs` or `candidacies`:

```sql
-- migration 0009 (fixed — hiring_jobs already has question_count,
-- shared_question_count, personalized_question_count from 0008)
ALTER TABLE hiring_jobs ADD COLUMN interview_template text NOT NULL DEFAULT 'balanced'
  CHECK (interview_template IN ('personality_behavioral','technical_behavioral','balanced','custom'));
-- Generator must read the job row's counts instead of hardcoding count: 6.
```

#### B2 — HR UI (`HrCandidateWorkspace`)

- Template dropdown before "Generate questions"
- Show split preview: `3 behavioral · 3 technical-behavioral`
- Allow per-question edit, reorder, delete before approve
- Badge: `origin: resume | shared | corpus`

#### B3 — Generator changes (`lib/hiring/questions.ts`)

- Read the job row (`question_count`, `interview_template`) instead of hardcoded `count: 6`.
- Do **post-filter/balance** per category (generate N, keep `behavioral` vs `technical-behavioral` per template). Avoids changing `generationSchema` (`.strict()`) and the shared workbench service → zero practice regression risk.
- Keep resume grounding rules from workbench (`profileEvidence` verbatim, projectId validation)

**Exit:** HR can generate personality-only or technical-only packs from same resume. `/demo/start` Step 5 proves it live.

---

### Phase C — Rich approved packs + HR overlay (3–5 days)

**Goal:** Expected answers available on HR report screen (private), not shown to candidate.

#### C1 — Extend `ApprovedQuestion` schema

Persist what practice/workbench already generates:

```typescript
// additions to approvedQuestionSchema — all OPTIONAL for backward compat
// (old packs in approved_question_packs.questions lack these; worker falls back)
intent: z.string().optional()
strongAnswerIndicators: z.array(z.string()).min(1).max(6).optional()
followUps: z.array(z.string()).max(4).default([]).optional()
rubricId: z.string().optional()
earlyCareerGuidance: z.string().optional()
```

Migration: widen `approved_question_packs.questions` JSON (no table change if jsonb).

#### C2 — HR report overlay UI

On `/hr/interviews/[sessionId]/report`:

- Left: recording + transcript
- Right panel (HR-only): current question's **Listen for**, **Rubric anchors**, **Suggested follow-ups**
- Sync panel to question selected in timeline
- Reuse patterns from `dev/workbench.tsx` detail sidebar

#### C3 — Processing alignment

Ensure evaluation worker reads approved pack metadata when scoring (not hardcoded indicators in `processing/worker.ts:139`). `JOIN` latest `approved_question_packs` for `intent`/`strongAnswerIndicators`; fall back to placeholder only for pre-C1 packs. Never expose pack metadata to `getCandidateVisibleReport()` (HR-only; `requireOrgAccess`).

**Exit:** Recruiter watching a recording sees expected-answer guide per question.

---

### Phase D — Scoring & composite (4–6 days; DEFER composite past judges)

**Goal:** Per-question rubric + optional composite index per docs/04.

**Judge cut:** ship D1 breakdown + coverage badges only. Suppress the composite on stage (docs/04: "display breakdowns without a composite until coverage threshold is chosen"). Full D2–D4 lands post-hackathon after the validation set (strong/middling/weak answers) in docs/04.

#### D1 — Per-question evaluation (already partial)

- Confirm `evaluation_items` stores dimension ratings + evidence excerpts
- Tie each item to `interview_plan_questions.id` and pack question id
- Insufficient evidence → `rating: null`, never fabricate

#### D2 — Composite index (hiring only)

Implement docs/04 formula:

```
composite = 100 × Σ(weight × (rating − 1) / 4) / Σ(weight)
```

Rules:

- Only rated dimensions count
- Suppress composite if any **required** dimension missing for template
- Show coverage badge: `4/5 dimensions rated`
- Label: **"Screening index — not a hiring recommendation"**
- Practice mode: **never** show composite (unchanged)

#### D3 — Template-specific weights

| Template | Dimension weights (example) |
| --- | --- |
| personality_behavioral | Relevance 1.2, Reflection 1.2, Clarity 1.0, … |
| technical_behavioral | Reasoning 1.3, Specificity 1.2, … |

Store weights in versioned JSON (`rubric_templates` table or corpus file).

#### D4 — Report release mask

HR toggles before candidate sees feedback:

- summary, rubric, perQuestion, transcript, recordings
- Composite included only if `release_rubric` true AND coverage sufficient

**Exit:** HR report shows dimension breakdown + optional composite; candidate sees only released sections.

---

### Phase E — Solana & audit (stretch, 2–4 days)

**Goal:** Align story with docs without blocking demo.

| Option | Effort | Demo value |
| --- | --- | --- |
| **E1 (current)** | Done | Memo txs with opaque commitments — good enough |
| **E2** | Medium | Deploy Anchor program to devnet; log PDA addresses in outbox |
| **E3** | High | Replace memo with program instructions |

Recommend **E1 for hackathon**, E2 post-hackathon.

Actions already enqueued: `issue_invitation`, `attest_identity`, `activate_access`, `record_completion`, `update_report_permissions`.

---

### Phase F — Production deploy (friend, parallel)

| Step | Action |
| --- | --- |
| F1 | Vercel/host app with production env |
| F2 | TigerData + migrate through `0008` |
| F3 | Stable webhook URL (not ephemeral cloudflared) |
| F4 | Clerk org provisioning for demo company |
| F5 | R2 bucket + CORS + retention cron |
| F6 | Worker cron (`POST /api/hiring/worker`) every 1–5 min |

---

## 4. Data flow (target state)

```
HR                          Candidate                    System
──                          ─────────                    ──────
Create job + template  ──►
Upload/parse resume    ──►
Generate pack          ──►  (Gemini + corpus + resume)
Edit + approve         ──►  approved_question_packs (+ rich metadata)
Issue invitation       ──►  invite link
                       ──►  Sign in (confirmed email)
                       ──►  Persona verify (webhook → verified)
                       ──►  Interview room (frozen plan, record answers)
                       ──►  Submit → processing jobs
Process transcript     ◄──  Scribe / Gemini
Evaluate per question  ◄──  evaluateAnswer (evidence-bound)
Build report           ◄──  dimensions + optional composite
HR review + overlay    ──►  private notes, release mask
                       ──►  Candidate feedback (released only)
Solana outbox          ◄──  commitments at each gate
```

---

## 5. Test matrix

| Test | Type | Phase |
| --- | --- | --- |
| Fresh session twice → 2 independent candidacies, no reuse | E2E | A0 |
| Judge resume project appears in ≥1 question | E2E | A0 |
| Links work on tunnel/Vercel origin (no localhost baked in) | E2E | A0 |
| Fallback pack labeled when Gemini down | E2E | A0 |
| Practice E2E unchanged | Regression | Always |
| Template generates correct category mix | Unit | B |
| Resume project appears in ≥1 question | Integration | B |
| Approved pack retains indicators | Unit | C |
| HR overlay shows question N metadata | E2E | C |
| Composite suppressed when dimension null | Unit | D |
| Composite matches hand-calculated sample | Unit | D |
| Persona webhook → verified | Integration | A (done) |
| Solana outbox finalizes | Integration | A (done) |
| Cross-user access denied | Security | Always |
| Retention clears PII, keeps commitments | Integration | A (done) |

---

## 6. Demo script — perfect 5-minute judge run (all live, nothing pre-baked)

Setup (before judges arrive): app up, `HIRING_ENABLED=true`, funded Solana wallet, tunnel + Persona webhook verified, R2 CORS ok, `/demo/start` loaded. No seeded session open.

1. **` /demo/start` (60s, you narrate as HR)** — type org/job live: e.g. "Rice — Product Design Intern". Type candidate name/email (offer judge's project: "use your hackathon project name?"). Upload resume (or sample → parser preview shows their skills). Pick template: "Personality/Behavioral for this round". Say: "Nothing here is pre-made — I'm creating this session now."
2. **Generate → edit → approve (60s)** — click Generate, point at one question containing their resume project ("see — grounded in the resume we just uploaded"). Delete or edit one question live to prove HR control. Approve → Issue invitation → copy link. Show Solscan invitation commitment in a second tab (don't block on it).
3. **Candidate invite (30s)** — open invite link (second window/incognito). Sign in with confirmed email. Say: "Same link a real candidate gets — no backdoor."
4. **Persona verify (60s)** — click through Persona sandbox inquiry; webhook flips to verified live. Backup if webhook lags: labeled "sandbox fast-track" button (declare it as sandbox). Never a silent DB fake.
5. **Interview room (60s)** — frozen plan banner visible; record 1–2 answers (30–60s each), submit. Point out: no live follow-ups, retakes allowed before submit.
6. **HR report (30s + async)** — while worker processes, show Solscan identity attestation. When report lands: recording + transcript + per-question dimensions with coverage badges + private "Listen for" overlay (HR-only). State: "No auto hire/reject — composite suppressed; human decides. Candidate sees only released sections."
7. **Reset (10s)** — click Reset demo so next judge starts clean.

Failure lines (rehearse once): AI down → labeled fallback pack. Webhook slow → fast-track button. Upload fails → sample resume. Never show `/dev/hiring-links` or a 500 on stage.

---

## 7. Priority order (recommended)

```
Now     → Phase A0 (self-serve launcher)       ← blocks perfect demo, do first
Then    → Phase A (demo hardening)             ← friend + 1 E2E pass on /demo/start
Next    → Phase B (templates)                  ← highest product value
Then    → Phase C (HR overlay)                 ← docs promise this
Freeze  → Phase D composite                    ← breakdown-only for judges
Later   → Phase E (Anchor deploy)              ← story polish
Parallel→ Phase F (production)                ← friend
Never   → Touch practice session logic without explicit regression tests
Never   → Demo from /dev/hiring-links or hardcoded seed on stage
```

---

## 8. Open decisions (pick before Phase B/C)

| # | Question | Recommendation |
| --- | --- | --- |
| 1 | Template on job vs candidacy? | **Job-level** default, candidacy override optional |
| 2 | Show composite to candidate? | **No** by default; HR release toggle |
| 3 | Custom template = full manual? | Yes — skip generator or generate draft then free edit |
| 4 | Minimum questions per type? | 4 minimum, 6 default, 8 max |
| 5 | Solana on demo path? | Show Solscan link; don't block UI on finalize |

---

## 9. Success criteria (project complete)

- [ ] Judge run: fresh name/email/job/resume typed live on `/demo/start` → new session, no code or DB edits
- [ ] Same flow run twice → two independent candidacies; Reset revokes cleanly in <10s
- [ ] HR selects template → generates resume-grounded pack → approves → invites
- [ ] Candidate: Persona → recorded interview → submission
- [ ] HR report: recording, transcript, per-question scores, **private answer guide**
- [ ] Composite shown only when evidence sufficient, clearly labeled
- [ ] Practice mode regression suite green
- [ ] Persona + Solana demos use real sandbox/devnet (no bypass)
- [ ] Friend can deploy without agent assistance using runbook + this plan

---

## 10. Commands cheat sheet

```bash
# Dev
cd app && npm run dev
cd app && npm run tunnel:persona
cd app && npm run setup:persona-webhook https://YOUR.trycloudflare.com

# Verify
cd app && npm test
cd app && npm run verify:hiring-api
cd app && npm run verify:persona
cd app && npm run verify:solana

# Demo entry
open http://localhost:3000/demo/start   # judges start here (self-serve, nothing hardcoded)
open http://localhost:3000/dev/hiring-links  # engineering fallback only, never on stage
```

---

*This plan supersedes ad-hoc todo lists for post-hackathon hiring work. Phase A items from the verification sprint are marked done where verified September 12, 2026.*
