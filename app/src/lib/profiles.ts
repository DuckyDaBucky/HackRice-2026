import "server-only";
import {createHash} from "node:crypto";
import {db} from "./db";
import {resumeSchema,type Resume} from "./workbench/schemas";
import {WorkbenchError} from "./workbench/errors";
export function profileNamespace(){
 const key=process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
 if(!key)throw new WorkbenchError("AUTH_CONFIG","Clerk is not configured.",503);
 return createHash("sha256").update(key).digest("hex");
}
export async function getProfile(userId:string){
 const result=await db.query("SELECT profile,version,updated_at,classified_at FROM gmh_accounts.profiles WHERE clerk_instance=$1 AND clerk_user_id=$2",[profileNamespace(),userId]);
 const row=result.rows[0];return row?{profile:resumeSchema.parse(row.profile),version:row.version,updatedAt:row.updated_at,classifiedAt:row.classified_at}:null;
}
export async function saveProfile(userId:string,profile:Resume,version:number|null){
 const value=resumeSchema.parse(profile),namespace=profileNamespace();
 const result=version===null
 ?await db.query("INSERT INTO gmh_accounts.profiles(clerk_instance,clerk_user_id,profile) VALUES($1,$2,$3) ON CONFLICT DO NOTHING RETURNING version",[namespace,userId,JSON.stringify(value)])
 :await db.query("UPDATE gmh_accounts.profiles SET profile=$3,version=version+1,updated_at=now(),classified_at=now() WHERE clerk_instance=$1 AND clerk_user_id=$2 AND version=$4 RETURNING version",[namespace,userId,JSON.stringify(value),version]);
 if(!result.rowCount)throw new WorkbenchError("PROFILE_CONFLICT","Your profile changed in another tab. Load the saved profile before saving again.",409);
 return getProfile(userId);
}
