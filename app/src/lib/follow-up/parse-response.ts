/** Tolerant parse of a Gemini text response into a follow-up question, or null. */
export function parseFollowUpResponse(raw: string): string | null {
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
    !("followUp" in parsed) ||
    typeof (parsed as { followUp: unknown }).followUp !== "string"
  ) {
    return null;
  }

  const followUp = (parsed as { followUp: string }).followUp.trim();
  return followUp.length > 0 ? followUp : null;
}
