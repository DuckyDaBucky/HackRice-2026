import { z } from "zod";
import { resumeSchema, levelSchema, type Corpus, type Role } from "../schemas";
const short = z.string().trim().min(1).max(2000);
export const targetSchema = z.object({
  familyId: z.string().max(100).default(""), specialtyId: z.string().max(100).default(""),
  level: levelSchema.default("unknown"), technologies: z.array(z.string().max(100)).max(12).default([]),
  description: z.string().max(3000).default(""),
}).strict();
export type Target = z.infer<typeof targetSchema>;
export const contextSchema = z.object({
  profile: resumeSchema.optional(), target: targetSchema.optional(), useMemory: z.boolean().default(false),
}).strict();
export type AiContext = z.infer<typeof contextSchema>;
export const chatSchema = z.object({
  messages: z.array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().trim().min(1).max(16000) }).strict()).min(1).max(30),
  context: contextSchema,
}).strict().refine(v => v.messages.at(-1)?.role === "user", "End with a user message");
export const generationSchema = z.object({context:contextSchema, count:z.number().int().min(1).max(10).default(5)}).strict();
export const generatedQuestionSchema = z.object({
  prompt: short, category:z.enum(["behavioral","technical-behavioral"]), competency:short,
  intent:short, profileEvidence:z.array(short).max(5), projectId:z.string().max(100).nullable(),
  sourceQuestionId:z.string().max(150).nullable(), strongAnswerIndicators:z.array(short).min(1).max(6),
}).strict();
export const questionOutputSchema=z.object({questions:z.array(generatedQuestionSchema).min(1).max(10)}).strict();
export const questionPackSchema=z.object({
  id:z.uuid(), version:z.literal("1"), model:short, createdAt:z.iso.datetime(),
  questions:z.array(generatedQuestionSchema.extend({id:z.uuid(),origin:z.enum(["corpus-personalized","gemini-generated"]),sourceIds:z.array(z.string()),datasetVersion:z.string().nullable()})).min(1).max(10),
});
export type QuestionPack=z.infer<typeof questionPackSchema>;
export const evaluationRequestSchema=z.object({question:questionPackSchema.shape.questions.element,answer:z.string().trim().min(1).max(20000),context:contextSchema}).strict();
export const dimensions=["relevance","specificity","reasoning","reflection","clarity"] as const;
export const evaluationSchema=z.object({
  summary:short,
  dimensions:z.array(z.object({dimension:z.enum(dimensions),rating:z.number().int().min(1).max(5).nullable(),rationale:short,evidence:z.array(short).max(5)}).strict()).length(5),
  strengths:z.array(short).max(5),improvements:z.array(short).max(5),followUps:z.array(short).max(3),
  suggestedNotes:z.array(short).max(5),
}).strict();
export type Evaluation=z.infer<typeof evaluationSchema>;
export const memorySchema=z.object({id:z.string().min(1).max(200),content:z.string().max(12000)});
export type Memory=z.infer<typeof memorySchema>;
export type UsedContext={memories:Memory[];warnings:string[]};
export const memoryMutationSchema=z.discriminatedUnion("operation",[
  z.object({operation:z.literal("save"),content:short,confirmed:z.literal(true),requestId:z.uuid()}).strict(),
  z.object({operation:z.literal("edit"),id:short,content:short,confirmed:z.literal(true)}).strict(),
  z.object({operation:z.literal("delete"),id:short}).strict(),
  z.object({operation:z.literal("reset"),confirmed:z.literal(true)}).strict(),
]);
export type QuestionFilter={familyId?:string;specialtyId?:string;level?:string;technologies?:string[];search?:string;limit?:number};
export interface QuestionRepository {
  roles():Promise<Role[]>;
  search(filter:QuestionFilter):Promise<Corpus["questions"]>;
  findByIds(ids:string[]):Promise<Corpus["questions"]>;
  version():Promise<string>;
}
export interface PracticeMemory {
  list(userId:string):Promise<Memory[]>;
  search(userId:string,query:string):Promise<Memory[]>;
  mutate(userId:string,input:z.infer<typeof memoryMutationSchema>):Promise<void>;
}
