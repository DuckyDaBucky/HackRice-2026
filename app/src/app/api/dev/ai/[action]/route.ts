import {z} from "zod";
import {checkOrigin,requireDevUser} from "@/lib/workbench/access";
import {WorkbenchError} from "@/lib/workbench/errors";
import {chatSchema,generationSchema,evaluationRequestSchema,memoryMutationSchema} from "@/lib/workbench/ai/contracts";
import {generateQuestions,evaluateAnswer,startChat} from "@/lib/workbench/ai/service";
import {chatModel,chatModelId,providerError} from "@/lib/workbench/ai/gemini";
import {describeLlm} from "@/lib/llm/provider";
import {practiceMemory} from "@/lib/workbench/ai/backboard";
import {prepareSpeech,speechRequestSchema} from "@/lib/workbench/ai/speech";
export const runtime="nodejs";
export const dynamic="force-dynamic";
type Context={params:Promise<{action:string}>};
const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"no-store"}});
function failure(e:unknown){
  if(e instanceof WorkbenchError)return json({error:{code:e.code,message:e.message}},e.status);
  if(e instanceof z.ZodError||e instanceof SyntaxError)return json({error:{code:"INVALID_INPUT",message:"Check the submitted fields and try again."}},400);
  return json({error:{code:"FAILED",message:"The operation failed. Your input has not been cleared."}},500);
}
async function readBody(request:Request){
  const reader=request.body?.getReader();if(!reader)throw new WorkbenchError("EMPTY","No request body.");
  let size=0;const parts:Uint8Array[]=[];
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>512000){await reader.cancel();throw new WorkbenchError("TOO_LARGE","Keep this request below 500 KB.",413);}parts.push(value);}}
  finally{reader.releaseLock();}
  return JSON.parse(Buffer.concat(parts).toString("utf8"));
}
export async function GET(request:Request,context:Context){
  try{
    const user=await requireDevUser(),{action}=await context.params;
    if(action==="status")return json({llm:describeLlm(),backboard:{configured:Boolean(process.env.BACKBOARD_API_KEY)},database:process.env.GET_ME_HIRED_RESEARCH_SOURCE==="database"?"Research database configured":"Local research files configured",persistence:"Approved notes in Backboard only; chats, profiles and reports are temporary."});
    if(action==="memory")return json({memories:await practiceMemory.list(user)});
    throw new WorkbenchError("NOT_FOUND","Not found",404);
  }catch(e){return failure(e);}
}
export async function POST(request:Request,context:Context){
  try{
    const user=await requireDevUser();checkOrigin(request);const {action}=await context.params;
    const input=await readBody(request);
    if(action==="speech-plan")return json(prepareSpeech(speechRequestSchema.parse(input)));
    if(action==="questions")return json(await generateQuestions(user,generationSchema.parse(input),request.signal));
    if(action==="evaluate")return json(await evaluateAnswer(user,evaluationRequestSchema.parse(input),request.signal));
    if(action==="memory"){
      await practiceMemory.mutate(user,memoryMutationSchema.parse(input));
      return json({memories:await practiceMemory.list(user),message:"Backboard accepted the change. The list below reflects its current stored notes; refresh if processing is pending."});
    }
    if(action==="check"){
      const {provider}=z.object({provider:z.enum(["llm","backboard"])}).strict().parse(input);
      if(provider==="backboard")return json(await practiceMemory.check());
      try{
        await chatModel().withStructuredOutput(z.object({ready:z.literal(true)}),{name:"connection_check"}).invoke("Return ready: true.",{signal:AbortSignal.any([request.signal,AbortSignal.timeout(30000)])});
        return json({verifiedAt:new Date().toISOString(),model:chatModelId()});
      }catch(e){throw providerError(e);}
    }
    if(action==="chat"){
      const data=chatSchema.parse(input),abort=new AbortController();
      const signal=AbortSignal.any([request.signal,abort.signal,AbortSignal.timeout(60000)]);
      const {stream,usedContext,model}=await startChat(user,data,signal);
      const encoder=new TextEncoder();let closed=false;
      const body=new ReadableStream<Uint8Array>({
        async start(controller){
          const emit=(value:unknown)=>{if(!closed)controller.enqueue(encoder.encode(JSON.stringify(value)+"\n"));};
          try{
            emit({type:"context",usedContext,model});let text="";
            for await(const chunk of stream){
              const delta=typeof chunk.content==="string"?chunk.content:chunk.content.filter(b=>b.type==="text").map(b=>"text" in b?b.text:"").join("");
              if(delta){text+=delta;if(text.length>60000)throw new WorkbenchError("OUTPUT_LIMIT","Response exceeded the demo limit. Ask a narrower question.",502);emit({type:"delta",text:delta});}
            }
            if(!text.trim())throw new WorkbenchError("EMPTY_RESPONSE","Gemini returned no text. Retry or rephrase the message.",502);
            emit({type:"done"});
          }catch(e){const error=providerError(e);emit({type:"error",error:{code:error.code,message:error.message}});}
          finally{if(!closed){closed=true;controller.close();}abort.abort();}
        },
        cancel(){closed=true;abort.abort();},
      });
      return new Response(body,{headers:{"Content-Type":"application/x-ndjson; charset=utf-8","Cache-Control":"no-store","X-Content-Type-Options":"nosniff"}});
    }
    throw new WorkbenchError("NOT_FOUND","Not found",404);
  }catch(e){return failure(e);}
}
