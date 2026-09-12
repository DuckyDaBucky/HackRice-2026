"use client";

import { useState, useTransition } from "react";
import type { ApprovedQuestion } from "@/lib/hiring/contracts";
import {
  hrConfirmCandidate,
  hrGenerateQuestions,
  hrApproveQuestions,
  hrIssueInvitation,
} from "@/app/hr/actions";

export function HrCandidateWorkspace({
  candidacyId,
  organizationId,
}: {
  candidacyId: string;
  organizationId: string;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [questions, setQuestions] = useState<ApprovedQuestion[]>([]);
  const [inviteMessage, setInviteMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  return (
    <div className="mt-6 space-y-8 text-zinc-200">
      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">Candidate identity</h2>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Confirmed name"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
        <input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Confirmed email (required for invitation)"
          className="w-full rounded border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm"
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              await hrConfirmCandidate(organizationId, candidacyId, name, email);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Failed");
            }
          })}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Confirm details
        </button>
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">Question pack</h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              const result = await hrGenerateQuestions(organizationId, candidacyId);
              setQuestions(result.questions);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Generation failed");
            }
          })}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Generate questions
        </button>
        <ul className="space-y-2 text-sm">
          {questions.map((q) => (
            <li key={q.id} className="rounded border border-zinc-900 p-3">
              <span className="text-zinc-500">Q{q.position} · {q.category}</span>
              <p className="mt-1 text-zinc-200">{q.prompt}</p>
            </li>
          ))}
        </ul>
        {questions.length > 0 && (
          <button
            type="button"
            disabled={pending}
            onClick={() => startTransition(async () => {
              try {
                await hrApproveQuestions(organizationId, candidacyId, questions);
                setError(null);
              } catch (e) {
                setError(e instanceof Error ? e.message : "Approval failed");
              }
            })}
            className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
          >
            Approve pack
          </button>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-zinc-800 p-4">
        <h2 className="text-sm font-medium text-zinc-400">Invitation</h2>
        <button
          type="button"
          disabled={pending}
          onClick={() => startTransition(async () => {
            try {
              const origin = window.location.origin;
              const result = await hrIssueInvitation(organizationId, candidacyId, {
                appOrigin: origin,
                recruiterContact: email,
              });
              setInviteMessage(result.message);
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Invitation failed");
            }
          })}
          className="rounded border border-zinc-700 px-3 py-1.5 text-sm hover:bg-zinc-900"
        >
          Generate copyable message
        </button>
        {inviteMessage && (
          <div className="space-y-2">
            <p className="text-xs text-zinc-500">Message ready to copy — not delivered.</p>
            <textarea readOnly value={inviteMessage} rows={12} className="w-full rounded border border-zinc-800 bg-zinc-950 p-3 text-xs font-mono text-zinc-300" />
          </div>
        )}
      </section>

      {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    </div>
  );
}
