"use client";

import { useState, useTransition } from "react";
import type { ApprovedQuestion } from "@/lib/hiring/contracts";
import type { InterviewTemplate } from "@/lib/hiring/questions";
import {
  hrLiveApproveAndInvite,
  hrLiveCreateSession,
  hrLiveFindSession,
  hrLiveGenerateQuestions,
  hrLiveParseResume,
  hrLiveSaveResumeText,
  hrLiveUploadResume,
} from "@/app/hr/live-actions";

type Session = {
  organizationId: string;
  jobId: string;
  candidacyId: string;
};

const INITIAL = {
  companyName: "",
  jobTitle: "",
  candidateName: "",
  candidateEmail: "",
  interviewTemplate: "balanced" as InterviewTemplate,
  resumeText: "",
};

export function HrLiveDemo() {
  const [form, setForm] = useState(INITIAL);
  const [session, setSession] = useState<Session | null>(null);
  const [questions, setQuestions] = useState<ApprovedQuestion[]>([]);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [reportSessionId, setReportSessionId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function resetAll() {
    setForm(INITIAL);
    setSession(null);
    setQuestions([]);
    setInviteUrl(null);
    setReportSessionId(null);
    setStatus("Ready for the next judge — all fields cleared.");
    setError(null);
  }

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-zinc-800 p-5 space-y-4">
        <h2 className="text-sm font-medium text-zinc-400">1 · Build the session live</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Company name" value={form.companyName} onChange={(v) => setForm((f) => ({ ...f, companyName: v }))} placeholder="Acme Corp" />
          <Field label="Job title" value={form.jobTitle} onChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))} placeholder="Software Engineer" />
          <Field label="Candidate name" value={form.candidateName} onChange={(v) => setForm((f) => ({ ...f, candidateName: v }))} placeholder="Judge's name" />
          <Field label="Candidate email" value={form.candidateEmail} onChange={(v) => setForm((f) => ({ ...f, candidateEmail: v }))} placeholder="they@example.com" />
        </div>
        <label className="block text-xs text-zinc-500">
          Interview type
          <select
            value={form.interviewTemplate}
            onChange={(e) => setForm((f) => ({ ...f, interviewTemplate: e.target.value as InterviewTemplate }))}
            className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
          >
            <option value="balanced">Balanced (behavioral + technical-behavioral)</option>
            <option value="personality_behavioral">Personality / behavioral</option>
            <option value="technical_behavioral">Technical behavioral</option>
          </select>
        </label>
        <button
          type="button"
          disabled={pending || !form.companyName || !form.jobTitle || !form.candidateName || !form.candidateEmail}
          onClick={() => startTransition(async () => {
            try {
              const created = await hrLiveCreateSession(form);
              setSession(created);
              setQuestions([]);
              setInviteUrl(null);
              setReportSessionId(null);
              setStatus("New job and candidate created — nothing reused from prior judges.");
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Could not create session");
            }
          })}
          className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-medium text-zinc-950 disabled:opacity-40"
        >
          Create fresh session
        </button>
      </section>

      {session && (
        <>
          <section className="rounded-lg border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-medium text-zinc-400">2 · Resume (powers question personalization)</h2>
            <textarea
              value={form.resumeText}
              onChange={(e) => setForm((f) => ({ ...f, resumeText: e.target.value }))}
              rows={6}
              placeholder="Paste resume text — include a project name the judge gave you."
              className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={pending || form.resumeText.length < 40}
                onClick={() => startTransition(async () => {
                  try {
                    await hrLiveSaveResumeText(session.organizationId, session.candidacyId, form.resumeText);
                    const parsed = await hrLiveParseResume(session.organizationId, session.candidacyId);
                    setStatus(parsed.parsed ? "Resume parsed with AI." : `Backup profile used: ${parsed.error}`);
                    setError(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Resume save failed");
                  }
                })}
                className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
              >
                Save & parse pasted resume
              </button>
              <label className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900 cursor-pointer">
                Upload PDF/DOCX
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    startTransition(async () => {
                      try {
                        const fd = new FormData();
                        fd.set("file", file);
                        const uploaded = await hrLiveUploadResume(session.organizationId, session.candidacyId, fd);
                        setForm((f) => ({ ...f, resumeText: uploaded.extractedText }));
                        const parsed = await hrLiveParseResume(session.organizationId, session.candidacyId);
                        setStatus(parsed.parsed ? "File uploaded and parsed." : `Uploaded; backup profile: ${parsed.error}`);
                        setError(null);
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Upload failed — paste text instead.");
                      }
                    });
                  }}
                />
              </label>
            </div>
          </section>

          <section className="rounded-lg border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-medium text-zinc-400">3 · Generate & edit questions</h2>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => {
                try {
                  const result = await hrLiveGenerateQuestions(
                    session.organizationId,
                    session.candidacyId,
                    form.interviewTemplate,
                  );
                  setQuestions(result.questions);
                  setStatus("Questions generated from this resume.");
                  setError(null);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Generation failed");
                }
              })}
              className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
            >
              Generate questions
            </button>
            <ul className="space-y-2">
              {questions.map((q, index) => (
                <li key={q.id} className="rounded border border-zinc-900 p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-zinc-500 shrink-0">Q{index + 1} · {q.category}</span>
                    <button
                      type="button"
                      className="text-xs text-red-300"
                      onClick={() => setQuestions((prev) => prev.filter((x) => x.id !== q.id).map((x, i) => ({ ...x, position: i + 1 })))}
                    >
                      Delete
                    </button>
                  </div>
                  <textarea
                    value={q.prompt}
                    onChange={(e) => setQuestions((prev) => prev.map((x) => x.id === q.id ? { ...x, prompt: e.target.value } : x))}
                    rows={2}
                    className="mt-2 w-full rounded border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm"
                  />
                  {q.profileEvidence.length > 0 && (
                    <p className="mt-1 text-xs text-sky-400/80">Resume evidence: {q.profileEvidence.join(" · ")}</p>
                  )}
                </li>
              ))}
            </ul>
            {questions.length > 0 && (
              <button
                type="button"
                disabled={pending}
                onClick={() => startTransition(async () => {
                  try {
                    const result = await hrLiveApproveAndInvite(
                      session.organizationId,
                      session.candidacyId,
                      questions,
                      window.location.origin,
                    );
                    setInviteUrl(result.invitationUrl);
                    setStatus("Pack approved — invite link ready.");
                    setError(null);
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "Approve failed");
                  }
                })}
                className="rounded-full bg-sky-500 px-5 py-2.5 text-sm font-medium text-zinc-950"
              >
                Approve & copy invite
              </button>
            )}
            {inviteUrl && (
              <div className="rounded border border-sky-500/30 bg-sky-500/10 p-3 text-sm break-all">
                <p className="text-sky-200 font-medium">Candidate invite link</p>
                <a href={inviteUrl} className="text-sky-400 underline">{inviteUrl}</a>
                <button
                  type="button"
                  className="ml-3 text-xs text-zinc-400 underline"
                  onClick={() => void navigator.clipboard.writeText(inviteUrl)}
                >
                  Copy
                </button>
              </div>
            )}
          </section>

          <section className="rounded-lg border border-zinc-800 p-5 space-y-3">
            <h2 className="text-sm font-medium text-zinc-400">4 · After candidate records</h2>
            <button
              type="button"
              disabled={pending}
              onClick={() => startTransition(async () => {
                try {
                  const found = await hrLiveFindSession(session.organizationId, session.candidacyId);
                  if (!found) {
                    setStatus("No interview session yet — candidate still verifying or recording.");
                    return;
                  }
                  setReportSessionId(found.interview_session_id);
                  setStatus(`Session found (${found.status}).`);
                } catch (e) {
                  setError(e instanceof Error ? e.message : "Lookup failed");
                }
              })}
              className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
            >
              Find interview / report
            </button>
            {reportSessionId && (
              <a
                href={`/hr/interviews/${reportSessionId}/report?org=${session.organizationId}`}
                className="text-sky-400 underline text-sm"
              >
                Open HR report →
              </a>
            )}
            <p className="text-xs text-zinc-500">
              The computer scores answers — it does not hire or reject. A human makes the decision.
            </p>
          </section>
        </>
      )}

      <section className="flex items-center justify-between border-t border-zinc-800 pt-6">
        <div className="text-sm">
          {status && <p className="text-emerald-300/90">{status}</p>}
          {error && <p className="text-red-300">{error}</p>}
        </div>
        <button type="button" onClick={resetAll} className="rounded border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900">
          Reset for next judge
        </button>
      </section>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <label className="block text-xs text-zinc-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
      />
    </label>
  );
}
