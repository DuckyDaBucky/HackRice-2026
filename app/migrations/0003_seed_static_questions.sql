-- 0003_seed_static_questions.sql
--
-- The `questions` table (0001) has existed with no rows in it: the app's
-- static question bank (src/lib/questions/static-source.ts) has always
-- used its own ad-hoc string ids ("technical-1", ...) instead of rows
-- here, so nothing could ever satisfy answer_attempts' FK to
-- questions(id, mode) (0002). This seeds fixed-id rows matching the
-- static source exactly, so recorded answers can finally be persisted.
--
-- Ids are hardcoded (not gen_random_uuid()) so the same six ids can be
-- hardcoded into static-source.ts and stay stable across environments.
--
-- Apply by hand:
--   psql "$DATABASE_URL" -f app/migrations/0003_seed_static_questions.sql

BEGIN;

INSERT INTO questions (id, mode, prompt, sequence) VALUES
    ('25cbfeb2-2183-42ee-8cd3-fbfc4a0d7d15', 'technical',
     'Walk me through a design decision you made on a recent project and why you made it.', 0),
    ('f2929ec5-6d99-4036-bc03-fe4ef59e5795', 'technical',
     'Describe a bug you had a hard time tracking down. How did you find and fix it?', 1),
    ('1f1c3843-ec7d-44a1-84db-2cd8a383e4ed', 'technical',
     'Tell me about a tradeoff between two approaches you had to choose between.', 2),
    ('7d1454e7-2df5-4cfe-8987-6fd874e46d6c', 'behavioral',
     'Tell me about a time you disagreed with a teammate. How did you resolve it?', 0),
    ('dd0b891e-7bf0-4a10-af3b-ec87c3de4702', 'behavioral',
     'Describe a time you had to meet a tight deadline. What did you do?', 1),
    ('ee6b6d74-3f6e-4beb-a9ca-b2823cc8a4bb', 'behavioral',
     'Tell me about a mistake you made at work and what you learned from it.', 2)
ON CONFLICT (id) DO NOTHING;

COMMIT;
