import {generateQuestions,evaluateAnswer,startChat} from "../src/lib/workbench/ai/service";
import {db} from "../src/lib/db";
async function main(){
 const context={useMemory:false};
 const generated=await generateQuestions("synthetic-smoke",{context,count:2});
 console.log("Question generation passed");
 const question=generated.pack.questions[0];
 const result=await evaluateAnswer("synthetic-smoke",{context,question,answer:"In a class project our API timed out under load. I reproduced the failure using a small load test, added timing logs, and traced it to repeated database queries. I discussed caching versus batching with my teammate. We chose batching because freshness mattered. I added regression tests and compared query counts before and after. I would collect baseline latency earlier next time."});
 console.log("Report evaluation passed");
 const {stream}=await startChat("synthetic-smoke",{context,messages:[{role:"user",content:"Give one short tip for explaining a technical tradeoff."}]},AbortSignal.timeout(30000));
 let chunks=0;for await(const chunk of stream)if(chunk.content)chunks++;
 if(!chunks)throw new Error("Empty stream");
 console.log(JSON.stringify({passed:true,questions:generated.pack.questions.length,reportDimensions:result.evaluation.dimensions.length,chatStream:true,model:generated.pack.model}));
}
main().catch(e=>{console.error(JSON.stringify({passed:false,code:e.code??"FAILED",message:e.code?e.message:"Provider smoke test failed"}));process.exitCode=1;}).finally(()=>db.end());
