import {randomUUID} from "node:crypto";
import {db} from "../src/lib/db";
import {getProfile,saveProfile,profileNamespace} from "../src/lib/profiles";
import {classifyExperience} from "../src/lib/workbench/experience";
import {emptyResume} from "../src/lib/workbench/schemas";
async function main(){const user="synthetic-profile-"+randomUUID();try{
 const profile={...emptyResume,sections:[{kind:"education" as const,title:"Currently enrolled CS student, expected graduation May 2027",organization:null,dates:"Expected May 2027",evidence:["Currently enrolled, expected graduation May 2027."]}]};
 const classification=await classifyExperience(profile);if(classification.experienceLevel!=="intern")throw new Error("Classification mismatch");
 console.log("Experience classification passed");
 const saved=await saveProfile(user,{...profile,...classification},null);
 if(!saved||saved.version!==1||(await getProfile(user))?.profile.experienceLevel!=="intern"||await getProfile(user+"-other"))throw new Error("Persistence/isolation mismatch");
 await saveProfile(user,saved.profile,1);
 let conflict=false;try{await saveProfile(user,saved.profile,1);}catch{conflict=true;}if(!conflict)throw new Error("Concurrency failure");
 console.log(JSON.stringify({passed:true,llmExperience:true,persisted:true,reloaded:true,userIsolation:true,staleWriteRejected:true}));
 }finally{await db.query("DELETE FROM gmh_accounts.profiles WHERE clerk_instance=$1 AND clerk_user_id=$2",[profileNamespace(),user]);}}
main().catch(e=>{console.error(JSON.stringify({passed:false,code:e.code??e.name,message:typeof e.message==="string"?e.message.replaceAll(process.env.GOOGLE_API_KEY??"SECRET","[redacted]").slice(0,300):"Profile verification failed"}));process.exitCode=1;}).finally(()=>db.end());
