export const integrationSlots = [
  {id:"generation",name:"Interview generation",status:"Available in AI playground",detail:"Generate personalized questions, stream AI chat and evaluate text answers. Requires a working LLM key (MODEL_API_KEY)."},
  {id:"memory",name:"Backboard memory",status:"Available in AI playground",detail:"Inspect, save, edit and delete approved per-user practice notes. Requires a working Backboard key; nothing is saved automatically."},
  {id:"spectra",name:"Presage SmartSpectra",status:"Exploratory",detail:"SDK input/output contract and runtime need validation. No camera or physiological data is captured."},
  {id:"voice",name:"ElevenLabs + avatars",status:"Deferred",detail:"Future question speech and optional artwork. No synthesis or avatar service is connected."},
  {id:"captions",name:"Subtitles",status:"Planned",detail:"Future small, medium, large and extra-large captions with readable contrast and independent text. No live transcript yet."},
] as const;
export interface MemoryAdapter { read(userId:string):Promise<string[]>; reset(userId:string):Promise<void>; }
export interface CameraObservation { timestamp:string; signal:string; value:number|null; quality:"unavailable"|"low"|"usable"; }
export interface SpeechAdapter { synthesize(text:string):Promise<Uint8Array>; }
