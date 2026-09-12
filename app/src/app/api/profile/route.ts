import {auth} from "@clerk/nextjs/server";
import {z} from "zod";
import {getProfile,saveProfile} from "@/lib/profiles";
import {classifyExperience,classificationDate} from "@/lib/workbench/experience";
import {resumeSchema} from "@/lib/workbench/schemas";
import {checkOrigin} from "@/lib/workbench/access";
import {WorkbenchError} from "@/lib/workbench/errors";
export const runtime="nodejs";
export const dynamic="force-dynamic";
const json=(value:unknown,status=200)=>Response.json(value,{status,headers:{"Cache-Control":"no-store"}});
const failure=(e:unknown)=>e instanceof WorkbenchError?json({error:{message:e.message}},e.status):e instanceof z.ZodError||e instanceof SyntaxError?json({error:{message:"Invalid profile fields."}},400):json({error:{message:"Profile operation failed. Your changes have not been saved; retry after checking service availability."}},503);
export async function GET(){try{const {userId}=await auth();if(!userId)return json({error:{message:"Sign in to access your profile."}},401);return json({account:await getProfile(userId),analysisDate:classificationDate(),timeZone:"UTC"});}catch(e){return failure(e);}}
export async function PUT(request:Request){try{
 const {userId}=await auth();if(!userId)return json({error:{message:"Sign in to save your profile."}},401);checkOrigin(request);
 const reader=request.body?.getReader();if(!reader)throw new WorkbenchError("INVALID_INPUT","A profile is required.",400);
 const parts:Uint8Array[]=[];let size=0;
 try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>512000){await reader.cancel();throw new WorkbenchError("TOO_LARGE","Profile is too large.",413);}parts.push(value);}}finally{reader.releaseLock();}
 const input=z.object({profile:resumeSchema,version:z.number().int().positive().nullable(),confirmed:z.literal(true)}).strict().parse(JSON.parse(Buffer.concat(parts).toString("utf8")));
 const classified=await classifyExperience(input.profile);
 return json({account:await saveProfile(userId,{...input.profile,...classified},input.version),analysisDate:classificationDate(),timeZone:"UTC"});
 }catch(e){return failure(e);}}
