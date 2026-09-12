import { handlePersonaWebhook } from "@/lib/persona/webhook";
import { hiringEnabled } from "@/lib/hiring/config";

export async function POST(request: Request) {
  if (!hiringEnabled()) {
    return Response.json({ error: "Hiring flow disabled" }, { status: 503 });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("persona-signature") ?? request.headers.get("x-persona-signature");
  try {
    const result = await handlePersonaWebhook(rawBody, signature);
    return Response.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webhook processing failed";
    return Response.json({ error: message }, { status: 400 });
  }
}
