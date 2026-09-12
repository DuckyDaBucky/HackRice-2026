import {z} from "zod";
import {questionPackSchema} from "./contracts";
export const speechRequestSchema=z.object({pack:questionPackSchema,voiceId:z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).optional(),subtitleSize:z.enum(["small","medium","large","extra-large"]).default("medium")}).strict();
export type SpeechRequest=z.infer<typeof speechRequestSchema>;
/** Pure preparation only. No audio is generated or candidate data sent to a voice provider. */
export function prepareSpeech(input:SpeechRequest){
 return {version:"1" as const,packId:input.pack.id,provider:"elevenlabs" as const,status:"prepared-not-synthesized" as const,
   voiceId:input.voiceId??null,subtitleSize:input.subtitleSize,
   items:input.pack.questions.map((q,index)=>({id:`${input.pack.id}:${q.id}`,questionId:q.id,order:index,
     text:q.prompt,subtitleText:q.prompt,textFormat:"plain" as const,language:"en",audio:null,
     playback:{interruptible:true,requiresUserGesture:true}}))};
}
export type SpeechPlan=ReturnType<typeof prepareSpeech>;
export interface QuestionVoiceProvider {
 synthesize(request:{text:string;voiceId:string;requestId:string;signal:AbortSignal}):Promise<{audio:Uint8Array;mimeType:string;providerRequestId?:string}>;
}
export type PlaybackEvent={packId:string;questionId:string;type:"started"|"paused"|"completed"|"cancelled"|"failed";occurredAt:string};
