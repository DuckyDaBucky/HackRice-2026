/** Extracts a safe, single generated interview question from model JSON. */
export function parseGeneratedQuestion(raw: string): string | null {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripped);
  } catch {
    return null;
  }

  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("question" in parsed) ||
    typeof (parsed as { question: unknown }).question !== "string"
  ) {
    return null;
  }

  const question = (parsed as { question: string }).question.trim();
  if (question.length < 12 || question.length > 500) return null;
  return question;
}
