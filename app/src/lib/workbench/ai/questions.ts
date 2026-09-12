import "server-only";
import { loadCorpus } from "../corpus";
import type { QuestionRepository, QuestionFilter } from "./contracts";

// Uses the validated database or external-file loader; never import research as source.
export class FileQuestionRepository implements QuestionRepository {
  async roles() {return (await loadCorpus()).roles;}
  async version() {return (await loadCorpus()).manifest.version;}
  async findByIds(ids:string[]) {return (await loadCorpus()).questions.filter(q=>ids.includes(q.id));}
  async search(filter:QuestionFilter) {
    const {questions}=await loadCorpus();
    return questions.filter(q=>(!filter.familyId||q.familyId===filter.familyId)
      &&(!filter.specialtyId||q.specialtyIds.includes(filter.specialtyId))
      &&(!filter.level||filter.level==="unknown"||q.level.includes(filter.level))
      &&(!filter.technologies?.length||filter.technologies.some(t=>q.technologies.includes(t)))
      &&(!filter.search||`${q.prompt} ${q.intent}`.toLowerCase().includes(filter.search.toLowerCase())))
      .slice(0,filter.limit??30);
  }
}
export const questionRepository:QuestionRepository=new FileQuestionRepository();
