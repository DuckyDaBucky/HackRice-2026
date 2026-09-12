import { buildFollowUpPrompt } from "@/lib/follow-up/build-prompt";
import { parseFollowUpResponse } from "@/lib/follow-up/parse-response";
import { isInterviewMood, MAX_CUSTOM_PROMPT_LENGTH } from "@/lib/interview-config";
import type { InterviewMode } from "@/lib/questions/types";

interface FollowUpRequestBody {
  mode: InterviewMode;
  questionPrompt: string;
  transcriptSoFar: string;
  mood?: unknown;
  customPrompt?: unknown;
}

function isValidBody(body: unknown): body is FollowUpRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const b = body as Record<string, unknown>;
  return (
    (b.mode === "technical" || b.mode === "behavioral") &&
    typeof b.questionPrompt === "string" &&
    typeof b.transcriptSoFar === "string"
  );
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY is not configured");
    return Response.json({ followUp: null });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidBody(body)) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const prompt = buildFollowUpPrompt({
    ...body,
    mood: isInterviewMood(body.mood) ? body.mood : undefined,
    customPrompt:
      typeof body.customPrompt === "string"
        ? body.customPrompt.slice(0, MAX_CUSTOM_PROMPT_LENGTH)
        : undefined,
  });

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            responseMimeType: "application/json",
            // Live in-call feature: full thinking-mode latency (multiple
            // seconds) is unacceptable here. thinkingBudget: 0 is rejected
            // by this model (INVALID_ARGUMENT) — 128 is the smallest
            // budget verified to work, cutting thinking tokens ~3-4x.
            thinkingConfig: { thinkingBudget: 128 },
          },
        }),
      },
    );

    if (!response.ok) {
      console.error("Gemini follow-up request failed", response.status, await response.text());
      return Response.json({ followUp: null });
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const followUp = text ? parseFollowUpResponse(text) : null;
    return Response.json({ followUp });
  } catch (error) {
    console.error("Gemini follow-up request errored", error);
    return Response.json({ followUp: null });
  }
}
