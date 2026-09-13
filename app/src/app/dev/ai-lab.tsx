"use client";
import {useEffect,useRef,useState} from "react";
import type {Resume} from "@/lib/workbench/schemas";
import type {AiContext,Target,Memory,UsedContext,QuestionPack,Evaluation} from "@/lib/workbench/ai/contracts";
import type {SpeechPlan} from "@/lib/workbench/ai/speech";
import styles from "./ai-lab.module.css";

type Status={llm:{provider:string;model:string;configured:boolean};backboard:{configured:boolean};database:string};
type Turn={id:string;role:"user"|"assistant";content:string;complete?:boolean};
type ChatRequest={messages:{role:"user"|"assistant";content:string}[];context:AiContext};
type Report={id:string;evaluation:Evaluation;warnings:string[];model:string;createdAt:string;questionId:string;usedContext:UsedContext};
async function call<T>(action:string,body?:unknown):Promise<T>{
  const response=await fetch(`/api/dev/ai/${action}`,{method:body===undefined?"GET":"POST",headers:body===undefined?undefined:{"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body),cache:"no-store"});
  const result=await response.json();if(!response.ok)throw new Error(result.error?.message||"Request failed.");return result as T;
}
export default function AiLab({profile,target,onResume}:{profile?:Resume;target:Target;onResume:()=>void}){
  const [mode,setMode]=useState("Chat"),[status,setStatus]=useState<Status|null>(null);
  const [attachProfile,setAttachProfile]=useState(true),[attachTarget,setAttachTarget]=useState(true),[useMemory,setUseMemory]=useState(false);
  const [recentSeeds,setRecentSeeds]=useState<string[]>([]),[selection,setSelection]=useState<{seed:string;level:string;focusProjectId:string|null;selectedQuestionIds:string[]}|null>(null);
  const [speechPlan,setSpeechPlan]=useState<SpeechPlan|null>(null);
  const [notice,setNotice]=useState(""),[error,setError]=useState(""),[busy,setBusy]=useState("");
  const [checks,setChecks]=useState<Record<string,string>>({});
  const [turns,setTurns]=useState<Turn[]>([]),[message,setMessage]=useState(""),[streaming,setStreaming]=useState(false);
  const [used,setUsed]=useState<UsedContext>({memories:[],warnings:[]});
  const [count,setCount]=useState(5),[pack,setPack]=useState<QuestionPack|null>(null),[questionId,setQuestionId]=useState("");
  const [answer,setAnswer]=useState(""),[report,setReport]=useState<Report|null>(null),[draftNotes,setDraftNotes]=useState<string[]>([]);
  const [notes,setNotes]=useState<Memory[]>([]),[notesLoaded,setNotesLoaded]=useState(false),[newNote,setNewNote]=useState("");
  const [confirmSave,setConfirmSave]=useState(false),[confirmReset,setConfirmReset]=useState(false);
  const abort=useRef<AbortController|null>(null),saveId=useRef<string|null>(null);
  const [lastRequest,setLastRequest]=useState<ChatRequest|null>(null);
  const bottom=useRef<HTMLDivElement>(null);
  useEffect(()=>{let live=true;call<Status>("status").then(s=>{if(live)setStatus(s);}).catch(e=>{if(live)setError(e.message);});return()=>{live=false;abort.current?.abort();};},[]);
  useEffect(()=>{bottom.current?.scrollIntoView({block:"nearest"});},[turns]);
  const context:AiContext={...(attachProfile&&profile?{profile}:{}),...(attachTarget?{target}:{}),useMemory};
  const question=pack?.questions.find(q=>q.id===questionId)??pack?.questions[0];
  async function run(label:string,fn:()=>Promise<void>){setBusy(label);setError("");setNotice("");try{await fn();}catch(e){setError(e instanceof Error?e.message:"Something went wrong.");}finally{setBusy("");}}
  async function chat(request:ChatRequest){
    if(abort.current)return;
    const control=new AbortController();abort.current=control;setLastRequest(request);setStreaming(true);setError("");setNotice("");
    const assistantId=crypto.randomUUID();
    setTurns([...request.messages.map(m=>({...m,id:crypto.randomUUID(),complete:true})),{id:assistantId,role:"assistant",content:"",complete:false}]);
    setUsed({memories:[],warnings:[]});
    try{
      const response=await fetch("/api/dev/ai/chat",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(request),signal:control.signal});
      if(!response.ok){const data=await response.json();throw new Error(data.error?.message||"Chat unavailable.");}
      const reader=response.body?.getReader();if(!reader)throw new Error("Chat stream is unavailable.");
      let pending="",completed=false;const decoder=new TextDecoder();
      const consume=(line:string)=>{
        if(!line.trim())return;const event=JSON.parse(line);
        if(event.type==="delta")setTurns(old=>old.map(t=>t.id===assistantId?{...t,content:t.content+event.text}:t));
        if(event.type==="context")setUsed(event.usedContext);
        if(event.type==="error")throw new Error(event.error.message);
        if(event.type==="done"){completed=true;setTurns(old=>old.map(t=>t.id===assistantId?{...t,complete:true}:t));}
      };
      try{while(true){const {value,done}=await reader.read();if(done)break;pending+=decoder.decode(value,{stream:true});const lines=pending.split("\n");pending=lines.pop()??"";lines.forEach(consume);}pending+=decoder.decode();consume(pending);}
      finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
      if(!completed)throw new Error("Response ended early. Retry to request a complete answer.");
    }catch(e){if(control.signal.aborted)setNotice("Stopped. The partial reply is not included in future context.");else setError(e instanceof Error?e.message:"Chat failed.");}
    finally{abort.current=null;setStreaming(false);}
  }
  function send(){
    if(!message.trim()||streaming)return;
    const messages=[...turns.filter(t=>t.role==="user"||t.complete).map(({role,content})=>({role,content})),{role:"user" as const,content:message.trim()}].slice(-30);
    setMessage("");void chat({messages,context});
  }
  async function refreshNotes(){const result=await call<{memories:Memory[]}>("memory");setNotes(result.memories);setNotesLoaded(true);}
  async function mutate(input:unknown){const r=await call<{memories:Memory[];message:string}>("memory",input);setNotes(r.memories);setNotesLoaded(true);setNotice(r.message);}
  const locked=!!busy||streaming;
  return <section className={styles.lab} aria-label="AI playground">
    <div className={styles.heading}><div><p className={styles.eyebrow}>LIVE AI / PRIVATE PRACTICE</p><h2>Put the conversation to work.</h2><p>Chat with the AI reviewer, try an interview, and choose what to remember.</p></div><span className={styles.pill}>Database disconnected</span></div>
    <div className={styles.layout}>
      <aside className={styles.context}>
        <h3>Choose your context</h3><p>Only checked items are attached to new AI requests.</p>
        <label><input type="checkbox" checked={attachProfile&&!!profile} disabled={!profile||locked} onChange={e=>setAttachProfile(e.target.checked)}/>Reviewed resume profile</label>
        <small>{profile?`${profile.projects.length} projects · ${profile.experienceLevel}`:"Parse or enter a profile, then confirm its facts in Resume lab."}</small><button onClick={onResume} disabled={streaming}>Open resume lab →</button>
        <label><input type="checkbox" checked={attachTarget} disabled={locked} onChange={e=>setAttachTarget(e.target.checked)}/>Selected role and preferences</label>
        <small>{target.familyId||"General / not sure"} · {target.specialtyId||"Any specialty"} · {target.level}{target.technologies.length?` · ${target.technologies.join(", ")}`:""}</small>
        <label><input type="checkbox" checked={useMemory} disabled={locked} onChange={e=>setUseMemory(e.target.checked)}/>Retrieve my saved practice notes</label><small>Backboard retrieves up to five relevant notes. Nothing is saved by chatting.</small>
        <hr/><h3>Provider connections</h3>{(["llm","backboard"] as const).map(provider=><div className={styles.provider} key={provider}><strong>{provider==="llm"?"AI reviewer":"Backboard"}</strong><small>{status?.[provider].configured?checks[provider]?`Verified ${checks[provider]}`:"Key configured · unverified":"Not configured"}</small>{provider==="llm"&&<small>{status?`${status.llm.provider} · ${status.llm.model}`:""}</small>}<button disabled={locked} onClick={()=>run(`Checking ${provider}`,async()=>{setChecks(c=>{const next={...c};delete next[provider];return next;});const s=await call<Status>("status");setStatus(s);const r=await call<{verifiedAt:string}>("check",{provider});setChecks(c=>({...c,[provider]:new Date(r.verifiedAt).toLocaleTimeString()}));})}>Check {provider}</button></div>)}
        <p className={styles.caption}>Profiles, chat and feedback last only while this page is open. Only confirmed notes persist in Backboard.</p>
      </aside>
      <div className={styles.workspace}>
        <nav className={styles.tabs} aria-label="AI tools">{["Chat","Interview","Memory"].map(t=><button key={t} aria-pressed={mode===t} disabled={locked} onClick={()=>setMode(t)}>{t}</button>)}</nav>
        {error&&<div role="alert" className={styles.error}>{error}</div>}<p className={styles.notice} role="status">{busy||notice}</p>
        <div hidden={mode!=="Chat"}>
          <div className={styles.toolbar}><h3>AI conversation</h3><button disabled={locked||!turns.length} onClick={()=>{setTurns([]);setLastRequest(null);setUsed({memories:[],warnings:[]});setError("");setNotice("Started a new conversation. Saved Backboard notes are unchanged.");}}>New conversation</button></div>
          <div className={styles.messages} aria-label="Conversation">
            {!turns.length&&<div className={styles.empty}><h3>Start with something real.</h3><p>Ask about a project, rehearse an explanation, or test how the reviewer uses your confirmed experience.</p><button onClick={()=>setMessage("Help me practice explaining a technical tradeoff. Ask me one question at a time.")}>Try a practice prompt</button></div>}
            {turns.map(t=><article key={t.id} className={t.role==="user"?styles.user:styles.assistant}><strong>{t.role==="user"?"You":"AI"}{t.role==="assistant"&&!t.complete?" · incomplete":""}</strong><p>{t.content||"Waiting for the reviewer…"}</p></article>)}<div ref={bottom}/>
          </div>
          <form onSubmit={e=>{e.preventDefault();send();}}><label className={styles.field}>Message AI<textarea value={message} maxLength={16000} rows={3} onChange={e=>setMessage(e.target.value)} placeholder="Ask a question or rehearse an answer…" disabled={streaming}/></label><div className={styles.actions}><button className={styles.primary} disabled={locked||!message.trim()} type="submit">Send message ↗</button>{streaming?<button type="button" onClick={()=>abort.current?.abort()}>Stop response</button>:<button type="button" disabled={!!busy||!lastRequest} onClick={()=>{if(lastRequest)void chat(lastRequest);}}>Retry last message</button>}</div></form>
        </div>
        <div hidden={mode!=="Interview"}>
          <div className={styles.toolbar}><h3>Build a practice interview</h3><label>Questions <input aria-label="Question count" type="number" min={1} max={10} value={count} onChange={e=>setCount(Number(e.target.value))}/></label></div>
          <p>Your reviewed profile and selected role are included by default. AI assigns experience from documented education and work history; user-selected levels cannot override it. Relevant questions vary between packs; recent topics are avoided within this session.</p>
          <button className={styles.primary} disabled={locked||count<1||count>10} onClick={()=>run("Generating personalized questions",async()=>{const r=await call<{pack:QuestionPack;usedContext:UsedContext;selection:{seed:string;level:string;focusProjectId:string|null;selectedQuestionIds:string[]}}>("questions",{context,count,excludedQuestionIds:recentSeeds});setPack(r.pack);setSelection(r.selection);setRecentSeeds(old=>[...new Set([...old,...r.selection.selectedQuestionIds])].slice(-200));setQuestionId(r.pack.questions[0].id);setAnswer("");setReport(null);setDraftNotes([]);setUsed(r.usedContext);})}>Generate question pack →</button>
          {selection&&<p className={styles.caption}>Experience: {selection.level} · Focus: {profile?.projects.find(p=>p.id===selection.focusProjectId)?.name??"General experience"} · Selection reference: {selection.seed}</p>}
          {pack&&<details><summary>ElevenLabs handoff</summary><p>Prepare question text and playback IDs for the audio layer. This does not generate speech or transcribe answers.</p><button disabled={locked} onClick={()=>run("Preparing speech handoff",async()=>setSpeechPlan(await call<SpeechPlan>("speech-plan",{pack,subtitleSize:"medium"})))}>Prepare speech plan</button>{speechPlan?.packId===pack.id&&<pre>{JSON.stringify(speechPlan,null,2)}</pre>}</details>}
          {pack&&<><p className={styles.caption}>{pack.model} · generated {new Date(pack.createdAt).toLocaleTimeString()}</p><div className={styles.questions}>{pack.questions.map((q,i)=><button key={q.id} aria-pressed={question?.id===q.id} disabled={locked} onClick={()=>{setQuestionId(q.id);setAnswer("");setReport(null);setDraftNotes([]);}}><small>{String(i+1).padStart(2,"0")} / {q.category}</small><span>{q.prompt}</span><small>{q.origin==="corpus-personalized"?`Adapted from ${q.sourceQuestionId}`:"New AI question"}</small></button>)}</div></>}
          {question&&<section className={styles.answer}><h3>{question.prompt}</h3><details><summary>Question context and evidence</summary><p>{question.intent}</p><p>Project: {question.projectId??"No project attached"}</p>{question.profileEvidence.map((e,i)=><blockquote key={i}>{e}</blockquote>)}<p>Dataset: {question.datasetVersion??"No corpus source"} · Source IDs: {question.sourceIds.join(", ")||"None"}</p></details><label className={styles.field}>Your answer or transcript<textarea rows={7} maxLength={20000} value={answer} onChange={e=>{setAnswer(e.target.value);setReport(null);setDraftNotes([]);}} placeholder="Type your answer or paste a transcript. Recording and transcription are coming later." disabled={locked}/></label><button className={styles.primary} disabled={locked||!answer.trim()} onClick={()=>run("Evaluating your answer",async()=>{const r=await call<Report>("evaluate",{question,answer,context});setReport(r);setDraftNotes(r.evaluation.suggestedNotes);setUsed(r.usedContext);})}>Get evidence-based feedback →</button></section>}
          {report&&<section className={styles.report}><p className={styles.eyebrow}>PRACTICE FEEDBACK / NO COMPOSITE SCORE</p><h3>{report.evaluation.summary}</h3>{report.warnings.map((w,i)=><p className={styles.caption} key={i}>{w}</p>)}<div className={styles.dimensions}>{report.evaluation.dimensions.map(d=><article key={d.dimension}><strong>{d.dimension} <span>{d.rating===null?"Insufficient evidence":`${d.rating}/5`}</span></strong><p>{d.rationale}</p>{d.evidence.map((e,i)=><blockquote key={i}>{e}</blockquote>)}</article>)}</div><h4>Strengths</h4><ul>{report.evaluation.strengths.map((s,i)=><li key={i}>{s}</li>)}</ul><h4>What to improve</h4><ul>{report.evaluation.improvements.map((s,i)=><li key={i}>{s}</li>)}</ul><h4>Follow-up questions</h4><ul>{report.evaluation.followUps.map((s,i)=><li key={i}>{s}</li>)}</ul><h4>Draft learning notes</h4><p>These are not saved. Edit a note, then review it in Memory.</p>{draftNotes.map((note,i)=><div className={styles.draft} key={i}><label className={styles.field}>Suggested note {i+1}<textarea rows={2} maxLength={2000} value={note} onChange={e=>setDraftNotes(old=>old.map((n,j)=>i===j?e.target.value:n))}/></label><button disabled={locked||!note.trim()} onClick={()=>{setNewNote(note);saveId.current=null;setConfirmSave(false);setMode("Memory");}}>Review for memory →</button></div>)}</section>}
        </div>
        <div hidden={mode!=="Memory"}>
          <div className={styles.toolbar}><h3>Your practice memory</h3><button disabled={locked} onClick={()=>run("Loading saved notes",refreshNotes)}>Refresh saved notes</button></div>
          <p>Only notes you explicitly confirm are sent to Backboard. Raw resumes, answers and chat histories are not saved here.</p>
          <label className={styles.field}>Note to remember<textarea rows={3} maxLength={2000} value={newNote} onChange={e=>{setNewNote(e.target.value);setConfirmSave(false);saveId.current=null;}} placeholder="For example: Practice explaining how I validated a design decision."/></label>
          <label className={styles.check}><input type="checkbox" checked={confirmSave} onChange={e=>setConfirmSave(e.target.checked)}/>I reviewed this note and want it saved in Backboard.</label><button className={styles.primary} disabled={locked||!confirmSave||!newNote.trim()} onClick={()=>run("Saving confirmed note",async()=>{saveId.current??=crypto.randomUUID();await mutate({operation:"save",content:newNote.trim(),confirmed:true,requestId:saveId.current});setNewNote("");setConfirmSave(false);saveId.current=null;})}>Save approved note</button>
          <div className={styles.saved}>{!notesLoaded?<p>Refresh to inspect your saved notes.</p>:!notes.length?<p>No saved notes for this user.</p>:notes.map(n=><MemoryEditor key={`${n.id}:${n.content}`} note={n} disabled={locked} onSave={content=>run("Updating note",()=>mutate({operation:"edit",id:n.id,content,confirmed:true}))} onDelete={()=>run("Deleting note",()=>mutate({operation:"delete",id:n.id}))}/>)}</div>
          <details><summary>Reset practice memory</summary><p>This permanently deletes all notes in your private practice assistant. It does not clear the current conversation; start a new one to remove earlier context from chat.</p><label className={styles.check}><input type="checkbox" checked={confirmReset} onChange={e=>setConfirmReset(e.target.checked)}/>Delete all my saved practice notes.</label><button disabled={locked||!confirmReset} onClick={()=>run("Resetting practice memory",async()=>{await mutate({operation:"reset",confirmed:true});setConfirmReset(false);})}>Reset all saved notes</button></details>
        </div>
        <details className={styles.used}><summary>Saved notes used in the latest AI response ({used.memories.length})</summary>{used.warnings.map((w,i)=><p key={i} className={styles.warning}>{w}</p>)}{used.memories.length?used.memories.map(n=><blockquote key={n.id}>{n.content}</blockquote>):<p>No saved notes were used.</p>}</details>
      </div>
    </div>
  </section>;
}
function MemoryEditor({note,disabled,onSave,onDelete}:{note:Memory;disabled:boolean;onSave:(content:string)=>void;onDelete:()=>void}){
  const [draft,setDraft]=useState(note.content),[deleting,setDeleting]=useState(false);
  return <article className={styles.memory}><label className={styles.field}>Saved note<textarea rows={3} maxLength={2000} value={draft} onChange={e=>setDraft(e.target.value)} disabled={disabled}/></label><div className={styles.actions}><button disabled={disabled||!draft.trim()||draft===note.content} onClick={()=>onSave(draft.trim())}>Save edited note</button><button disabled={disabled} onClick={()=>setDeleting(!deleting)}>{deleting?"Cancel deletion":"Delete note"}</button>{deleting&&<button disabled={disabled} onClick={onDelete}>Confirm deletion</button>}</div></article>;
}
