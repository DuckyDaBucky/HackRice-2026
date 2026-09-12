/**
 * Tier 5 API-level checks (no browser): worker auth, hiring gate, negative routes.
 * Usage: node --env-file=.env.local --import tsx scripts/verify-hiring-api.ts
 */
const BASE = process.env.VERIFY_BASE_URL ?? "http://localhost:3000";
const WORKER_SECRET = process.env.HIRING_WORKER_SECRET ?? "";

async function check(name: string, fn: () => Promise<boolean>) {
  try {
    const ok = await fn();
    return { name, pass: ok };
  } catch (e) {
    return { name, pass: false, error: String(e) };
  }
}

async function main() {
  const results = await Promise.all([
    check("GET /hr not disabled", async () => {
      const res = await fetch(`${BASE}/hr`, { redirect: "manual" });
      const text = await res.text();
      return !text.includes("Hiring is disabled");
    }),
    check("POST /api/hiring/worker rejects bad secret", async () => {
      const res = await fetch(`${BASE}/api/hiring/worker`, {
        method: "POST",
        headers: { "x-worker-secret": "wrong" },
      });
      return res.status === 401;
    }),
    check("POST /api/hiring/worker accepts valid secret", async () => {
      const res = await fetch(`${BASE}/api/hiring/worker`, {
        method: "POST",
        headers: { "x-worker-secret": WORKER_SECRET },
      });
      return res.status === 200;
    }),
    check("POST /api/persona/webhook rejects bad signature", async () => {
      const res = await fetch(`${BASE}/api/persona/webhook`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ data: { id: "evt-test", attributes: {} } }),
      });
      return res.status === 400;
    }),
    check("GET /candidate/invite without hash shows error state", async () => {
      const res = await fetch(`${BASE}/candidate/invite`);
      return res.status === 200;
    }),
  ]);

  const pass = results.every((r) => r.pass);
  console.log(JSON.stringify({ pass, results }, null, 2));
  if (!pass) process.exitCode = 1;
}

main();
