-- 0011_hiring_flow.sql (renamed from 0008_hiring_flow.sql to avoid colliding
-- with main's 0008_stats_analytics.sql; all statements are idempotent).
-- Hiring flow: organizations, jobs, candidacies, invitations, verification, sessions, reports, workers.

ALTER TABLE interview_sessions
  ADD COLUMN IF NOT EXISTS session_mode text NOT NULL DEFAULT 'practice';

ALTER TABLE interview_sessions
  DROP CONSTRAINT IF EXISTS interview_sessions_session_mode_check;

ALTER TABLE interview_sessions
  ADD CONSTRAINT interview_sessions_session_mode_check
  CHECK (session_mode IN ('practice', 'hiring_recorded'));

CREATE TABLE IF NOT EXISTS organizations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_org_id text NOT NULL UNIQUE,
  display_name text NOT NULL,
  provisioning_status text NOT NULL DEFAULT 'active'
    CHECK (provisioning_status IN ('pending', 'active', 'suspended')),
  max_invitations_per_day integer NOT NULL DEFAULT 50,
  max_solana_lamports_per_day bigint NOT NULL DEFAULT 500000000,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hiring_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  role_family text NOT NULL,
  specialty text,
  competencies jsonb NOT NULL DEFAULT '[]'::jsonb,
  question_count integer NOT NULL DEFAULT 6,
  time_budget_seconds integer NOT NULL DEFAULT 1200,
  language text NOT NULL DEFAULT 'en',
  shared_question_count integer NOT NULL DEFAULT 3,
  personalized_question_count integer NOT NULL DEFAULT 3,
  allow_live_follow_ups boolean NOT NULL DEFAULT false,
  created_by_clerk_user_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_hiring_jobs_org ON hiring_jobs(organization_id);

CREATE TABLE IF NOT EXISTS hiring_resumes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  candidacy_id uuid,
  original_filename text NOT NULL,
  r2_key text NOT NULL,
  extracted_text text NOT NULL,
  structured_facts jsonb NOT NULL DEFAULT '{}'::jsonb,
  resume_version integer NOT NULL DEFAULT 1,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS candidacies (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  job_id uuid NOT NULL REFERENCES hiring_jobs(id) ON DELETE CASCADE,
  confirmed_name text NOT NULL,
  confirmed_email text NOT NULL,
  resume_id uuid REFERENCES hiring_resumes(id) ON DELETE SET NULL,
  resume_version integer NOT NULL DEFAULT 1,
  clerk_user_id text,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN (
      'draft', 'questions_pending', 'ready_to_invite', 'invited',
      'verification_pending', 'verification_review', 'verified',
      'interview_in_progress', 'interview_completed', 'processing',
      'report_ready', 'revoked', 'expired', 'deleted'
    )),
  delete_after timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'hiring_resumes_candidacy_fkey'
  ) THEN
    ALTER TABLE hiring_resumes
      ADD CONSTRAINT hiring_resumes_candidacy_fkey
      FOREIGN KEY (candidacy_id) REFERENCES candidacies(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_candidacies_org ON candidacies(organization_id);
CREATE INDEX IF NOT EXISTS idx_candidacies_job ON candidacies(job_id);
CREATE INDEX IF NOT EXISTS idx_candidacies_email ON candidacies(confirmed_email);

CREATE TABLE IF NOT EXISTS approved_question_packs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidacy_id uuid NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  resume_version integer NOT NULL,
  questions jsonb NOT NULL,
  pack_commitment text NOT NULL,
  approved_by_clerk_user_id text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (candidacy_id, revision)
);

CREATE TABLE IF NOT EXISTS invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidacy_id uuid NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  pack_revision integer NOT NULL,
  secret_hash text NOT NULL UNIQUE,
  deadline_at timestamptz NOT NULL,
  recruiter_contact text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked', 'expired', 'superseded', 'accepted')),
  revoked_at timestamptz,
  superseded_by uuid REFERENCES invitations(id) ON DELETE SET NULL,
  solana_invitation_pda text,
  issued_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_invitations_candidacy ON invitations(candidacy_id);

CREATE TABLE IF NOT EXISTS verification_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  candidacy_id uuid NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  persona_inquiry_ref text NOT NULL,
  environment text NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'verified', 'review', 'failed')),
  name_match text CHECK (name_match IN ('match', 'mismatch', 'unknown')),
  bound_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS hiring_session_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  interview_session_id uuid NOT NULL UNIQUE REFERENCES interview_sessions(id) ON DELETE CASCADE,
  candidacy_id uuid NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  invitation_id uuid NOT NULL REFERENCES invitations(id) ON DELETE CASCADE,
  pack_revision integer NOT NULL,
  policy jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS report_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES interview_sessions(id) ON DELETE CASCADE,
  candidacy_id uuid NOT NULL REFERENCES candidacies(id) ON DELETE CASCADE,
  revision integer NOT NULL,
  revision_commitment text,
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'retryable_failed', 'terminal_failed')),
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  private_notes text,
  generated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (session_id, revision)
);

CREATE TABLE IF NOT EXISTS report_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_revision_id uuid NOT NULL REFERENCES report_revisions(id) ON DELETE CASCADE,
  release_summary boolean NOT NULL DEFAULT false,
  release_rubric boolean NOT NULL DEFAULT false,
  release_per_question boolean NOT NULL DEFAULT false,
  release_transcript boolean NOT NULL DEFAULT false,
  release_recordings boolean NOT NULL DEFAULT false,
  released_by_clerk_user_id text NOT NULL,
  released_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  solana_release_pda text
);

CREATE TABLE IF NOT EXISTS processing_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type text NOT NULL
    CHECK (job_type IN ('transcription', 'evaluation', 'solana_reconcile', 'retention')),
  target_id uuid NOT NULL,
  target_kind text NOT NULL,
  status text NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued', 'leased', 'completed', 'retryable_failed', 'terminal_failed')),
  lease_owner text,
  lease_expires_at timestamptz,
  attempts integer NOT NULL DEFAULT 0,
  next_run_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_processing_jobs_next_run ON processing_jobs(status, next_run_at);

CREATE TABLE IF NOT EXISTS solana_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  idempotency_key text NOT NULL UNIQUE,
  expected_revision integer,
  payload_commitment text NOT NULL,
  organization_id uuid REFERENCES organizations(id) ON DELETE SET NULL,
  candidacy_id uuid REFERENCES candidacies(id) ON DELETE SET NULL,
  invitation_id uuid REFERENCES invitations(id) ON DELETE SET NULL,
  tx_signature text,
  state text NOT NULL DEFAULT 'queued'
    CHECK (state IN ('queued', 'submitted', 'finalized', 'failed', 'reconcile_required')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  finalized_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_solana_outbox_state ON solana_outbox(state, created_at);

CREATE TABLE IF NOT EXISTS persona_webhook_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  inquiry_ref text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);
