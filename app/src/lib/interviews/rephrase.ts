import "server-only";

const MODEL = process.env.GEMINI_MODEL || "gemini-3.6-flash";

function fallbackRephrase(prompt: string) {
  return `Let me rephrase that: ${prompt}`;
}

/**
 * Produces a clarification of an already-approved question. It deliberately
 * cannot alter the topic, add a second question, evaluate the candidate, or
 * create new interview content. Provider failure preserves a usable spoken
 * fallback based on the exact saved wording.
 */
export async function rephraseInterviewQuestion(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return fallbackRephrase(prompt);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8_000);
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Rephrase this interview question in one concise spoken sentence. Preserve its exact intent and scope. Do not add hints, a second question, evaluation, or an answer. Return JSON only: {"wording":"..."}\n\nQuestion: ${prompt}` }] }],
          generationConfig: { responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 128 } },
        }),
      },
    );
    if (!response.ok) return fallbackRephrase(prompt);
    const data: unknown = await response.json();
    const raw = (data as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> })
      ?.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!raw) return fallbackRephrase(prompt);
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as { wording?: unknown };
    const wording = typeof parsed.wording === "string" ? parsed.wording.trim() : "";
    return wording.length >= 8 && wording.length <= 650 ? wording : fallbackRephrase(prompt);
  } catch {
    return fallbackRephrase(prompt);
  } finally {
    clearTimeout(timeout);
  }
}
