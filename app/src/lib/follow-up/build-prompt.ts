import type { InterviewMode } from "@/lib/questions/types";

export function buildFollowUpPrompt(input: {
  mode: InterviewMode;
  questionPrompt: string;
  transcriptSoFar: string;
}): string {
  return `You are conducting a live ${input.mode} practice interview.

Original question: "${input.questionPrompt}"

The candidate is mid-answer. Here is what they've said so far:
"${input.transcriptSoFar}"

Decide whether a short, natural clarifying follow-up would help right now
(e.g. asking them to go deeper on something they just mentioned). Only
suggest one if it's genuinely warranted. Do not ask for something they're
likely about to say next.

Respond with strict JSON only, no markdown, in exactly this shape:
{"followUp": "<one short follow-up question>" | null}`;
}
