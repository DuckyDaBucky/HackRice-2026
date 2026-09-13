import { isBlitzBudget } from "./interviews/contracts";

/**
 * Short spoken lines that bookend the interview so it feels like a natural
 * conversation instead of a recording widget. Kept deterministic (no model
 * call): they play while the candidate is settling in, and must stay under
 * ~30 words to avoid adding latency before the first question.
 */
export function buildIntroLine(params: {
  targetRole: string;
  seniority: string;
  timeBudgetSeconds: number;
  questionCount: number;
}): string {
  const role = params.targetRole.trim() || "the role you're practicing for";
  if (isBlitzBudget(params.timeBudgetSeconds)) {
    return (
      `Hey, I'm your GetMeHired interviewer. This is a blitz round for ${role}: ` +
      `one question, plus a quick follow-up if I need more detail. Take a breath, and let's dive in.`
    );
  }
  const level = params.seniority.replace("_", " ");
  return (
    `Hi, I'm your GetMeHired interviewer. Today we're practicing for a ${level} ${role} role: ` +
    `${params.questionCount} questions, and I may ask a follow-up when I want more detail. ` +
    `Answer out loud like it's the real thing. Let's start.`
  );
}

export function buildExitLine(params: {
  answeredCount: number;
  totalQuestions: number;
  timeBudgetSeconds: number;
}): string {
  const { answeredCount, totalQuestions } = params;
  if (isBlitzBudget(params.timeBudgetSeconds)) {
    return (
      `And that's our blitz! You answered ${answeredCount} of ${totalQuestions}. ` +
      `Your instant review is ready — let's see how you did.`
    );
  }
  if (answeredCount >= totalQuestions && totalQuestions > 0) {
    return (
      `That's a wrap — you answered all ${totalQuestions}. ` +
      `Your review is ready with a verdict on every answer. Nice work.`
    );
  }
  return (
    `That's time. You answered ${answeredCount} of ${totalQuestions}. ` +
    `Your review is ready — let's look at what landed and what to sharpen.`
  );
}
