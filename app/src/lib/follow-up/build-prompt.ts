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

Decide whether the original question has been answered with enough relevant,
specific detail to move on. Return null ONLY when it has. If it is vague,
very short, off-topic, missing the outcome, or missing the reasoning behind
the candidate's choice, return one short, natural clarifying follow-up.
Do not ask for something they're likely about to say next.

Respond with strict JSON only, no markdown, in exactly this shape:
{"followUp": "<one short follow-up question>" | null}`;
}
