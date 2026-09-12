import type { InterviewMode } from "@/lib/questions/types";
import { MOOD_FOLLOW_UP_INSTRUCTION, type InterviewMood } from "@/lib/interview-config";

export function buildFollowUpPrompt(input: {
  mode: InterviewMode;
  questionPrompt: string;
  transcriptSoFar: string;
  mood?: InterviewMood;
  customPrompt?: string | null;
}): string {
  const toneInstruction = MOOD_FOLLOW_UP_INSTRUCTION[input.mood ?? "neutral"];
  const focusInstruction = input.customPrompt
    ? `\nThe candidate asked the interviewer to focus on: "${input.customPrompt}". Let that shape the follow-up when relevant.\n`
    : "";

  return `You are conducting a live ${input.mode} practice interview. ${toneInstruction}

Original question: "${input.questionPrompt}"

The candidate is mid-answer. Here is what they've said so far:
"${input.transcriptSoFar}"
${focusInstruction}
Decide whether a short, natural clarifying follow-up would help right now
(e.g. asking them to go deeper on something they just mentioned). Only
suggest one if it's genuinely warranted. Do not ask for something they're
likely about to say next.

Respond with strict JSON only, no markdown, in exactly this shape:
{"followUp": "<one short follow-up question>" | null}`;
}
