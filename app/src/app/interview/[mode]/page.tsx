import { notFound } from "next/navigation";
import { InterviewSession } from "@/components/InterviewSession";
import {
  clampQuestionCount,
  DEFAULT_MOOD,
  DEFAULT_QUESTION_COUNT,
  isInterviewMood,
  MAX_CUSTOM_PROMPT_LENGTH,
} from "@/lib/interview-config";
import { DEFAULT_VOICE_ID } from "@/lib/voice/presets";
import type { InterviewMode } from "@/lib/questions/types";

function isInterviewMode(value: string): value is InterviewMode {
  return value === "technical" || value === "behavioral";
}

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function InterviewModePage({
  params,
  searchParams,
}: PageProps<"/interview/[mode]">) {
  const { mode } = await params;
  const search = await searchParams;

  if (!isInterviewMode(mode)) {
    notFound();
  }

  const resumeSessionId = firstParam(search.session);
  if (resumeSessionId) {
    return <InterviewSession mode={mode} resumeSessionId={resumeSessionId} />;
  }

  // Direct navigation without going through /interview/setup (e.g. an old link) still
  // works, just with sane defaults instead of erroring.
  const countParam = firstParam(search.count);
  const moodParam = firstParam(search.mood);
  const promptParam = firstParam(search.prompt);
  const setup = {
    questionCount: countParam ? clampQuestionCount(Number(countParam)) : DEFAULT_QUESTION_COUNT,
    mood: isInterviewMood(moodParam) ? moodParam : DEFAULT_MOOD,
    customPrompt: promptParam ? promptParam.slice(0, MAX_CUSTOM_PROMPT_LENGTH) : null,
    voiceId: firstParam(search.voice) || DEFAULT_VOICE_ID,
  };

  return <InterviewSession mode={mode} setup={setup} />;
}
