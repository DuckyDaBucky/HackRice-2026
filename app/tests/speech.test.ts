import {it,expect} from "vitest";
import {prepareSpeech} from "../src/lib/workbench/ai/speech";
import type {QuestionPack} from "../src/lib/workbench/ai/contracts";
it("hands off only question text in stable order, with no fake audio or answer guidance",()=>{
 const pack={id:"pack",questions:[{id:"q1",prompt:"Tell me about your project.",strongAnswerIndicators:["Private interviewer guidance"]},{id:"q2",prompt:"What would you change?"}]} as QuestionPack;
 const result=prepareSpeech({pack,subtitleSize:"large"});
 expect(result.items.map(i=>i.questionId)).toEqual(["q1","q2"]);
 expect(result.items.every(i=>i.audio===null&&i.text===i.subtitleText)).toBe(true);
 expect(result.status).toBe("prepared-not-synthesized");
 expect(JSON.stringify(result)).not.toContain("Private interviewer guidance");
 expect(prepareSpeech({pack,subtitleSize:"large"}).items[0].id).toBe(result.items[0].id);
});
