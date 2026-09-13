import { parseGeneratedQuestion } from "@/lib/questions/parse-generated-question";
import { completeJsonText, isLlmConfigured } from "@/lib/llm/provider";
import type { InterviewMode } from "@/lib/questions/types";

interface QuestionRequestBody {
  mode: InterviewMode;
  questionNumber: number;
  previous: Array<{ question: string; answer: string }>;
  cameraObservations?: unknown;
  presageNotes?: unknown;
}

function isValidBody(body: unknown): body is QuestionRequestBody {
  if (typeof body !== "object" || body === null) return false;
  const candidate = body as Record<string, unknown>;
  return (
    (candidate.mode === "technical" || candidate.mode === "behavioral") &&
    Number.isInteger(candidate.questionNumber) &&
    typeof candidate.questionNumber === "number" &&
    candidate.questionNumber >= 1 &&
    candidate.questionNumber <= 8 &&
    Array.isArray(candidate.previous) &&
    candidate.previous.every(
      (entry) =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).question === "string" &&
        typeof (entry as Record<string, unknown>).answer === "string",
    )
  );
}

function buildQuestionPrompt(input: QuestionRequestBody) {
  const camera = typeof input.cameraObservations === "string" ? input.cameraObservations.trim().slice(0, 500) : "";
  const presage = typeof input.presageNotes === "string" ? input.presageNotes.trim().slice(0, 1500) : "";
  const visualBlock =
    camera || presage
      ? "\nLive visual context (camera + Presage SmartSpectra practice cues only — never score, diagnose, or mention vitals; decide from answers first):\n" +
        (camera ? "Camera: " + camera + "\n" : "") +
        (presage ? "Presage: " + presage + "\n" : "")
      : "";
  const history = input.previous.length
    ? input.previous
        .map(
          ({ question, answer }, index) =>
            `Question ${index + 1}: ${question}\nCandidate answer: ${answer.slice(0, 2_000)}`,
        )
        .join("\n\n")
    : "No prior answers. Open with a welcoming, broadly useful question.";

  return `You are a realistic live ${input.mode} interviewer conducting question ${input.questionNumber} of 3.

Generate exactly one concise, spoken interview question. It must be a new question, avoid repeating the themes already covered, and naturally build on the candidate's prior answers where useful. Do not include an answer, explanation, greeting, label, or multiple questions.

Interview history:
${history}${visualBlock}

Respond with strict JSON only:
{"question":"<single interview question>"}`;
}

export async function POST(request: Request) {
  if (!isLlmConfigured()) {
    return Response.json({ error: "Question generation is unavailable" }, { status: 503 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  if (!isValidBody(body)) {
    return Response.json({ error: "Invalid question request" }, { status: 400 });
  }

  try {
    const { text } = await completeJsonText(buildQuestionPrompt(body), { timeoutMs: 15_000 });
    const question = text ? parseGeneratedQuestion(text) : null;
    if (!question) {
      return Response.json({ error: "Question generation returned invalid output" }, { status: 502 });
    }
    return Response.json({ question });
  } catch (error) {
    console.error("Question request errored", error);
    return Response.json({ error: "Question generation failed" }, { status: 502 });
  }
}
