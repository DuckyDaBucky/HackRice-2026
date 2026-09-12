/**
 * Exposes localhost:3000 over HTTPS for Persona webhooks.
 * Usage: node --import tsx scripts/start-persona-tunnel.ts
 * Prints webhook URL to paste into Persona Dashboard.
 */
import { spawn } from "node:child_process";

const port = process.env.PORT ?? "3000";

const child = spawn(
  "npx",
  ["--yes", "localtunnel", "--port", port],
  { stdio: ["ignore", "pipe", "pipe"], shell: true },
);

let url = "";
child.stdout.on("data", (chunk: Buffer) => {
  const text = chunk.toString();
  process.stdout.write(text);
  const match = text.match(/https:\/\/[^\s]+\.loca\.lt/);
  if (match) url = match[0];
});

child.stderr.on("data", (chunk: Buffer) => {
  process.stderr.write(chunk.toString());
});

child.on("exit", (code) => process.exit(code ?? 0));

setTimeout(() => {
  if (url) {
    console.log("\n--- Persona webhook setup ---");
    console.log(`Webhook URL: ${url}/api/persona/webhook`);
    console.log("Enable events: inquiry.completed, inquiry.approved, inquiry.failed, inquiry.declined, inquiry.marked-for-review");
    console.log("Copy the signing secret into PERSONA_WEBHOOK_SECRET in .env.local and restart npm run dev\n");
  }
}, 4000);
