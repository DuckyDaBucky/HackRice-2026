import {db} from "../src/lib/db";
async function main(){const client=await db.connect();try{
 await client.query("BEGIN");
 await client.query("CREATE SCHEMA IF NOT EXISTS gmh_accounts");
 await client.query(`CREATE TABLE IF NOT EXISTS gmh_accounts.profiles (
 clerk_instance text NOT NULL, clerk_user_id text NOT NULL,
 profile jsonb NOT NULL CHECK(jsonb_typeof(profile)='object'),
 version integer NOT NULL DEFAULT 1 CHECK(version>0),
 created_at timestamptz NOT NULL DEFAULT now(),updated_at timestamptz NOT NULL DEFAULT now(),classified_at timestamptz NOT NULL DEFAULT now(),
 PRIMARY KEY(clerk_instance,clerk_user_id))`);
 await client.query("COMMIT");console.log("Profile schema ready");
 }catch(e){await client.query("ROLLBACK");throw e;}finally{client.release();}}
main().catch(()=>{console.error("Profile schema setup failed");process.exitCode=1;}).finally(()=>db.end());
