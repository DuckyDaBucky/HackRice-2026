import { z } from "zod";

export const levelSchema = z.enum(["intern", "entry", "mid", "senior", "unknown"]);
const text = z.string().max(6000);
export const projectSchema = z.object({
  id: z.string().min(1).max(100), name: text, description: text,
  skills: z.array(text).max(60), competencies: z.array(text).max(30),
  contribution: text.nullable(), decisions: z.array(text).max(30),
  outcomes: z.array(text).max(30), evidence: z.array(text).max(30),
}).strict();
export const sectionSchema = z.object({
  kind: z.enum(["education", "employment", "internships", "research", "open-source", "certifications"]),
  title: text, organization: text.nullable(), dates: text.nullable(), evidence: z.array(text).max(20),
}).strict();
export const resumeSchema = z.object({
  experienceLevel: levelSchema, experienceReason: text,
  sections: z.array(sectionSchema).max(60), projects: z.array(projectSchema).max(40),
  skills: z.array(text).max(100), warnings: z.array(text).max(60),
}).strict();
export type Resume = z.infer<typeof resumeSchema>;
export type Project = z.infer<typeof projectSchema>;

const strings = z.array(z.string());
export const roleSchema = z.object({ id: z.string(), label: z.string(), aliases: strings,
  sourceIds: strings, competencies: strings, matchingTerms: strings, levels: strings, technologies: strings,
  specialties: z.array(z.object({ id: z.string(), label: z.string(), aliases: strings, technologies: strings })),
}).passthrough();
export type Role = z.infer<typeof roleSchema>;
export const questionSchema = z.object({
  id: z.string(), scenarioId: z.string(), familyId: z.string(), specialtyIds: strings,
  category: z.enum(["behavioral", "technical-behavioral"]), level: strings, competency: z.string(),
  technologies: strings, prompt: z.string(), intent: z.string(), followUps: strings,
  strongAnswerIndicators: strings, rubricId: z.string(), sourceIds: strings,
  personalizationFields: strings, origin: z.literal("original-authoring"), reviewStatus: z.string(),
  earlyCareerGuidance: z.string(), seniorExtension: z.string(),
}).passthrough();
export const sourceSchema = z.object({ id: z.string(), title: z.string(), publisher: z.string(),
  url: z.url().refine(v => /^https?:\/\//.test(v)), claim: z.string(), accessedAt: z.string(),
  publicationDate: z.string().nullable(), scope: z.string(), limitations: z.string(),
}).passthrough();
export const templateSchema = z.object({ id: z.string(), intent: z.string(), prompt: z.string(),
  requiredFields: strings, optionalFields: strings, missingFieldBehavior: z.string(), sourceIds: strings,
}).passthrough();
export const rubricSchema = z.object({ id: z.string(), competency: z.string(), anchors: z.record(z.string(), z.string()), indicators: strings, insufficientEvidence: z.string() });
export const scenarioSchema = z.object({ id: z.string(), familyId: z.string(), specialtyId: z.string(), context: z.string(), tradeoff: z.string(), validationExample: z.string(), sourceIds: strings, origin: z.string() });
export const manifestSchema = z.object({ schemaVersion: z.literal("1.0.0"), datasetId: z.string(), version: z.string(), createdAt: z.string(), questionCount: z.number().int().nonnegative(), familyCount: z.number().int().nonnegative(), specialtyCount: z.number().int().nonnegative(), files: z.record(z.string(), z.string()), notes: z.string() });
export const corpusSchema = z.object({ manifest: manifestSchema, roles: z.array(roleSchema), questions: z.array(questionSchema), sources: z.array(sourceSchema), templates: z.array(templateSchema), rubrics: z.array(rubricSchema), scenarios: z.array(scenarioSchema),
  classification: z.object({ schemaVersion: z.literal("1.0.0"), sections: strings, unknownPolicy: z.string(), experienceLevels: z.array(z.object({id:z.string(),rule:z.string()})), edgeCases: strings, sourceIds: strings }),
  ranking: z.object({schemaVersion:z.literal("1.0.0"),purpose:z.string(),status:z.string(), weights:z.object({roleRelevance:z.number(),competencyEvidence:z.number(),ownership:z.number(),technicalDepth:z.number(),outcomes:z.number()}),missingEvidence:z.string(),tieBreak:z.string(),exclusions:strings,sourceIds:strings,limitations:strings}),
  methodology: z.object({version:z.string(),audience:z.string(),approach:strings,limitations:strings,reviewProcess:strings,sourceIds:strings}),
});
export type Corpus = z.infer<typeof corpusSchema>;
export const emptyResume: Resume = {experienceLevel:"unknown",experienceReason:"Not parsed yet",sections:[],projects:[],skills:[],warnings:[]};
