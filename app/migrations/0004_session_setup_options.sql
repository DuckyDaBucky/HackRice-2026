-- 0004_session_setup_options.sql
--
-- Adds a real "new session" setup flow: question count, mood (affects
-- interviewer voice delivery and live follow-up tone), an optional
-- free-text focus prompt (also feeds follow-up generation), and the
-- chosen interviewer voice. Also expands the static question bank from
-- 3 to 6 per mode so "number of questions" has real content to slice
-- from instead of capping out at 3.
--
-- Apply by hand:
--   psql "$DATABASE_URL" -f app/migrations/0004_session_setup_options.sql

BEGIN;

ALTER TABLE interview_sessions
    ADD COLUMN question_count integer NOT NULL DEFAULT 3
        CHECK (question_count BETWEEN 1 AND 6),
    ADD COLUMN mood text NOT NULL DEFAULT 'neutral'
        CHECK (mood IN ('supportive', 'neutral', 'challenging')),
    ADD COLUMN custom_prompt text
        CHECK (custom_prompt IS NULL OR char_length(custom_prompt) <= 500),
    ADD COLUMN voice_id text;

INSERT INTO questions (id, mode, prompt, sequence) VALUES
    ('d9a11389-77e0-4d8e-8b90-6f878d8df74f', 'technical',
     'Tell me about a time you had to learn a new technology quickly for a project. How did you approach it?', 3),
    ('4023fd02-6407-4b6b-820c-51861c6c74ad', 'technical',
     'Describe a piece of code you''re proud of. What made it good?', 4),
    ('8e35225b-9bf8-45f9-ae17-f92a51342c44', 'technical',
     'Walk me through how you''d approach optimizing a slow-running part of an application.', 5),
    ('25fd309a-6eb0-4983-af95-b9d67f685656', 'behavioral',
     'Tell me about a time you had to give someone difficult feedback.', 3),
    ('c6c2e2b8-2a9c-4474-a015-d2cb1e7b49b1', 'behavioral',
     'Describe a situation where you had to make a decision with incomplete information.', 4),
    ('ca87bf42-0f77-478b-9dd4-e8763f7e17a1', 'behavioral',
     'Tell me about a time you took the initiative on something outside your normal responsibilities.', 5)
ON CONFLICT (id) DO NOTHING;

COMMIT;
