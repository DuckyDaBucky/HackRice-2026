import { clerkClient } from "@clerk/nextjs/server";
import { Pool } from "pg";

const email = (process.argv[2] ?? "hasnainmn7@gmail.com").trim().toLowerCase();
const role = (process.argv[3] ?? "developer").trim();

async function main() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await clerkClient();
  const users = await client.users.getUserList({ emailAddress: [email], limit: 1 });
  const user = users.data[0];

  if (!user) {
    console.log(JSON.stringify({ ok: false, message: "No Clerk user yet — sign in with Google first." }));
    await pool.end();
    return;
  }

  const updated = await pool.query(
    `UPDATE app_user_roles SET clerk_user_id = $1, role = $2, updated_at = now()
     WHERE lower(email) = lower($3)`,
    [user.id, role, email],
  );

  if ((updated.rowCount ?? 0) === 0) {
    await pool.query(
      `INSERT INTO app_user_roles (email, role, clerk_user_id) VALUES ($1, $2, $3)`,
      [email, role, user.id],
    );
  }

  const row = await pool.query(
    `SELECT email, role, clerk_user_id FROM app_user_roles WHERE lower(email) = lower($1)`,
    [email],
  );
  console.log(JSON.stringify({ ok: true, userId: user.id, role: row.rows[0] }));
  await pool.end();
}

main().catch((error) => {
  console.error(JSON.stringify({ ok: false, error: String(error) }));
  process.exitCode = 1;
});
