import type { InterviewMode, Question, QuestionSource } from "./types";

const QUESTIONS: Question[] = [
  {
    id: "technical-1",
    mode: "technical",
    prompt: "Walk me through a design decision you made on a recent project and why you made it.",
  },
  {
    id: "technical-2",
    mode: "technical",
    prompt: "Describe a bug you had a hard time tracking down. How did you find and fix it?",
  },
  {
    id: "technical-3",
    mode: "technical",
    prompt: "Tell me about a tradeoff between two approaches you had to choose between.",
  },
  {
    id: "behavioral-1",
    mode: "behavioral",
    prompt: "Tell me about a time you disagreed with a teammate. How did you resolve it?",
  },
  {
    id: "behavioral-2",
    mode: "behavioral",
    prompt: "Describe a time you had to meet a tight deadline. What did you do?",
  },
  {
    id: "behavioral-3",
    mode: "behavioral",
    prompt: "Tell me about a mistake you made at work and what you learned from it.",
  },
];

/** Placeholder question source until resume-driven / Gemini-generated packs exist. */
export const staticQuestionSource: QuestionSource = {
  async getQuestions(mode: InterviewMode): Promise<Question[]> {
    return QUESTIONS.filter((q) => q.mode === mode);
  },
};
