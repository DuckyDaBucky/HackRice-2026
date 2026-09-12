/**
 * Creates or updates the Persona sandbox webhook for this app.
 * Usage: node --env-file=.env.local --import tsx scripts/setup-persona-webhook.ts <https-tunnel-url>
 */
const tunnelBase = process.argv[2]?.replace(/\/$/, "");
if (!tunnelBase?.startsWith("https://")) {
  console.error("usage: setup-persona-webhook.ts https://your-tunnel.example.com");
  process.exit(1);
}

const apiKey = process.env.PERSONA_API_KEY;
if (!apiKey) throw new Error("PERSONA_API_KEY missing");

const webhookUrl = `${tunnelBase}/api/persona/webhook`;
const events = [
  "inquiry.completed",
  "inquiry.approved",
  "inquiry.failed",
  "inquiry.declined",
  "inquiry.marked-for-review",
];

async function persona(path: string, init?: RequestInit) {
  const res = await fetch(`https://withpersona.com/api/v1/${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      "Persona-Version": "2023-01-05",
      ...(init?.headers ?? {}),
    },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`${init?.method ?? "GET"} ${path} ${res.status}: ${text}`);
  return JSON.parse(text) as {
    data: { id: string; attributes: Record<string, unknown> } | Array<{ id: string; attributes: { url?: string } }>;
  };
}

function readSecret(attributes: Record<string, unknown>) {
  if (typeof attributes.secret === "string") return attributes.secret;
  const secrets = attributes.secrets;
  if (Array.isArray(secrets) && secrets[0] && typeof secrets[0].value === "string") {
    return secrets[0].value as string;
  }
  return "";
}

async function main() {
  const list = await persona("webhooks");
  const existing = Array.isArray(list.data) ? list.data : [];

  let webhookId = existing.find((w) => w.attributes.url === webhookUrl)?.id;
  let secret = "";

  if (webhookId) {
    const updated = await persona(`webhooks/${webhookId}`, {
      method: "PATCH",
      body: JSON.stringify({
        data: {
          attributes: {
            url: webhookUrl,
            "enabled-events": events,
            enabled: true,
          },
        },
      }),
    });
    const updatedRow = updated.data as { attributes: Record<string, unknown> };
    secret = readSecret(updatedRow.attributes);
  } else {
    const created = await persona("webhooks", {
      method: "POST",
      body: JSON.stringify({
        data: {
          attributes: {
            url: webhookUrl,
            "enabled-events": events,
            enabled: true,
          },
        },
      }),
    });
    const row = created.data as { id: string; attributes: Record<string, unknown> };
    webhookId = row.id;
    secret = readSecret(row.attributes);
  }

  console.log(JSON.stringify({
    webhookId,
    webhookUrl,
    secret,
    events,
    next: "Set PERSONA_WEBHOOK_SECRET in .env.local and restart npm run dev",
  }, null, 2));
}

main().catch((e) => {
  console.error(String(e));
  process.exitCode = 1;
});
