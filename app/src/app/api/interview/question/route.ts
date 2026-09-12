import { parseGeneratedQuestion } from "@/lib/questions/parse-generated-question";
import type { InterviewMode } from "@/lib/questions/types";

interface QuestionRequestBody {
  mode: InterviewMode;
  questionNumber: number;
  previous: Array<{ question: string; answer: string }>;
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
${history}

Respond with strict JSON only:
{"question":"<single interview question>"}`;
}

export async function POST(request: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
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
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: buildQuestionPrompt(body) }] }],
          generationConfig: {
            responseMimeType: "application/json",
            thinkingConfig: { thinkingBudget: 128 },
          },
        }),
      },
    );
    if (!response.ok) {
      console.error("Gemini question request failed", response.status, await response.text());
      return Response.json({ error: "Question generation failed" }, { status: 502 });
    }

    const data = await response.json();
    const text: string | undefined = data?.candidates?.[0]?.content?.parts?.[0]?.text;
    const question = text ? parseGeneratedQuestion(text) : null;
    if (!question) {
      return Response.json({ error: "Question generation returned invalid output" }, { status: 502 });
    }
    return Response.json({ question });
  } catch (error) {
    console.error("Gemini question request errored", error);
    return Response.json({ error: "Question generation failed" }, { status: 502 });
  }
}
