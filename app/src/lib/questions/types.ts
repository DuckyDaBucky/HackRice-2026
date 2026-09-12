export type InterviewMode = "technical" | "behavioral";

export interface Question {
  id: string;
  mode: InterviewMode;
  prompt: string;
}

export interface QuestionSource {
  getQuestions(mode: InterviewMode): Promise<Question[]>;
}
