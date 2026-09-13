import "server-only";

import { completeJsonText, isLlmConfigured } from "@/lib/llm/provider";

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
  if (!isLlmConfigured()) return fallbackRephrase(prompt);

  try {
    const { text: raw } = await completeJsonText(
      `Rephrase this interview question in one concise spoken sentence. Preserve its exact intent and scope. Do not add hints, a second question, evaluation, or an answer. Return JSON only: {"wording":"..."}\n\nQuestion: ${prompt}`,
      { timeoutMs: 8_000 },
    );
    const parsed = JSON.parse(raw.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "")) as { wording?: unknown };
    const wording = typeof parsed.wording === "string" ? parsed.wording.trim() : "";
    return wording.length >= 8 && wording.length <= 650 ? wording : fallbackRephrase(prompt);
  } catch {
    return fallbackRephrase(prompt);
  }
}
