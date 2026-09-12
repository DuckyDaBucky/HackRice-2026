import type { InterviewMode, Question, QuestionSource } from "./types";

// Ids match migrations/0003_seed_static_questions.sql exactly — answer_attempts
// has an FK to questions(id, mode), so these can't be arbitrary strings.
const QUESTIONS: Question[] = [
  {
    id: "25cbfeb2-2183-42ee-8cd3-fbfc4a0d7d15",
    mode: "technical",
    prompt: "Walk me through a design decision you made on a recent project and why you made it.",
  },
  {
    id: "f2929ec5-6d99-4036-bc03-fe4ef59e5795",
    mode: "technical",
    prompt: "Describe a bug you had a hard time tracking down. How did you find and fix it?",
  },
  {
    id: "1f1c3843-ec7d-44a1-84db-2cd8a383e4ed",
    mode: "technical",
    prompt: "Tell me about a tradeoff between two approaches you had to choose between.",
  },
  {
    id: "7d1454e7-2df5-4cfe-8987-6fd874e46d6c",
    mode: "behavioral",
    prompt: "Tell me about a time you disagreed with a teammate. How did you resolve it?",
  },
  {
    id: "dd0b891e-7bf0-4a10-af3b-ec87c3de4702",
    mode: "behavioral",
    prompt: "Describe a time you had to meet a tight deadline. What did you do?",
  },
  {
    id: "ee6b6d74-3f6e-4beb-a9ca-b2823cc8a4bb",
    mode: "behavioral",
    prompt: "Tell me about a mistake you made at work and what you learned from it.",
  },
  {
    id: "d9a11389-77e0-4d8e-8b90-6f878d8df74f",
    mode: "technical",
    prompt:
      "Tell me about a time you had to learn a new technology quickly for a project. How did you approach it?",
  },
  {
    id: "4023fd02-6407-4b6b-820c-51861c6c74ad",
    mode: "technical",
    prompt: "Describe a piece of code you're proud of. What made it good?",
  },
  {
    id: "8e35225b-9bf8-45f9-ae17-f92a51342c44",
    mode: "technical",
    prompt: "Walk me through how you'd approach optimizing a slow-running part of an application.",
  },
  {
    id: "25fd309a-6eb0-4983-af95-b9d67f685656",
    mode: "behavioral",
    prompt: "Tell me about a time you had to give someone difficult feedback.",
  },
  {
    id: "c6c2e2b8-2a9c-4474-a015-d2cb1e7b49b1",
    mode: "behavioral",
    prompt: "Describe a situation where you had to make a decision with incomplete information.",
  },
  {
    id: "ca87bf42-0f77-478b-9dd4-e8763f7e17a1",
    mode: "behavioral",
    prompt:
      "Tell me about a time you took the initiative on something outside your normal responsibilities.",
  },
];

/** Placeholder question source until resume-driven / Gemini-generated packs exist. */
export const staticQuestionSource: QuestionSource = {
  async getQuestions(mode: InterviewMode): Promise<Question[]> {
    return QUESTIONS.filter((q) => q.mode === mode);
  },
};
