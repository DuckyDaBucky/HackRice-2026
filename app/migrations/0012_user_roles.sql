-- App-level user roles for dashboard routing (Candidate / Developer / HR).

CREATE TABLE IF NOT EXISTS app_user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_user_id text UNIQUE,
  email text NOT NULL,
  role text NOT NULL CHECK (role IN ('candidate', 'developer', 'hr')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS app_user_roles_email_lower_idx ON app_user_roles (lower(email));

INSERT INTO app_user_roles (email, role)
SELECT 'hasnainmn7@gmail.com', 'developer'
WHERE NOT EXISTS (
  SELECT 1 FROM app_user_roles WHERE lower(email) = 'hasnainmn7@gmail.com'
);

UPDATE app_user_roles
SET role = 'developer', updated_at = now()
WHERE lower(email) = 'hasnainmn7@gmail.com';
