import { buildFollowUpPrompt } from "@/lib/follow-up/build-prompt";
import { parseFollowUpResponse } from "@/lib/follow-up/parse-response";
import { isInterviewMood, MAX_CUSTOM_PROMPT_LENGTH } from "@/lib/interview-config";
import { completeJsonText, isLlmConfigured } from "@/lib/llm/provider";
import type { InterviewMode } from "@/lib/questions/types";

interface FollowUpRequestBody {
  mode: InterviewMode;
  questionPrompt: string;
  transcriptSoFar: string;
  mood?: unknown;
  customPrompt?: unknown;
}

const FALLBACK_FOLLOW_UP = "Could you expand on that with a little more detail?";

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
  if (!isLlmConfigured()) {
    return Response.json({ followUp: FALLBACK_FOLLOW_UP });
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
    const { text } = await completeJsonText(prompt, { timeoutMs: 10_000 });
    const followUp = text ? parseFollowUpResponse(text) : null;
    return Response.json({ followUp });
  } catch (error) {
    console.error("Follow-up request errored", error);
    return Response.json({ followUp: FALLBACK_FOLLOW_UP });
  }
}
