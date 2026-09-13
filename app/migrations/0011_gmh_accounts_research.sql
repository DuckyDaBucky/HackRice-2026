-- 0011_gmh_accounts_research.sql
--
-- Creates the gmh_accounts / gmh_research schemas mirrored in
-- src/lib/db/schema.ts (accountProfiles, researchDatasets, researchDocuments).
-- Previously provisioned outside migrations/, so fresh databases 500'd on
-- getProfile/saveProfile and database-backed research. Idempotent.

BEGIN;

CREATE SCHEMA IF NOT EXISTS gmh_accounts;
CREATE SCHEMA IF NOT EXISTS gmh_research;

CREATE TABLE IF NOT EXISTS gmh_accounts.profiles (
    clerk_instance text NOT NULL,
    clerk_user_id text NOT NULL,
    profile jsonb NOT NULL,
    version integer NOT NULL DEFAULT 1,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now(),
    classified_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gmh_account_profiles_pkey PRIMARY KEY (clerk_instance, clerk_user_id),
    CONSTRAINT gmh_account_profiles_version_check CHECK (version >= 1)
);

CREATE TABLE IF NOT EXISTS gmh_research.datasets (
    version text NOT NULL,
    manifest_sha256 text NOT NULL,
    imported_at timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT gmh_research_datasets_pkey PRIMARY KEY (version)
);

CREATE TABLE IF NOT EXISTS gmh_research.documents (
    version text NOT NULL,
    name text NOT NULL,
    content text NOT NULL,
    sha256 text NOT NULL,
    CONSTRAINT gmh_research_documents_pkey PRIMARY KEY (version, name),
    CONSTRAINT gmh_research_documents_version_fkey FOREIGN KEY (version)
        REFERENCES gmh_research.datasets (version) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS gmh_research_documents_version_idx
    ON gmh_research.documents (version);

COMMIT;
