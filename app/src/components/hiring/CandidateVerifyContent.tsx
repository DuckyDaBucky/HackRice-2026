"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { candidateStartPersona, candidateGetVerificationStatus, candidateEnterInterview } from "@/app/candidate/actions";

export function CandidateVerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidacyId = params.get("candidacy") ?? "";
  const invitationId = params.get("invitation") ?? "";
  const [status, setStatus] = useState<string>("pending");
  const [sandboxLabel, setSandboxLabel] = useState("");

  useEffect(() => {
    if (!candidacyId || !invitationId) return;
    const interval = setInterval(() => {
      void candidateGetVerificationStatus(candidacyId).then((s) => setStatus(s.candidacyStatus ?? s.verificationStatus));
    }, 3000);
    return () => clearInterval(interval);
  }, [candidacyId, invitationId]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-50">Identity verification</h1>
      <p className="text-sm leading-relaxed text-zinc-400">
        Complete government ID and selfie verification before your interview. Approval is confirmed server-side via Persona webhook — browser completion alone does not grant access.
        {sandboxLabel}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            const result = await candidateStartPersona(invitationId, candidacyId);
            setSandboxLabel(result.sandboxLabel);
          } catch (e) {
            alert(e instanceof Error ? e.message : "Persona not configured");
          }
        }}
        className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-200 hover:bg-zinc-900"
      >
        Start Persona verification
      </button>
      <p className="text-xs text-zinc-500">Status: {status}</p>
      {(status === "verified" || status === "interview_in_progress") && (
        <button
          type="button"
          onClick={async () => {
            const sessionId = await candidateEnterInterview(candidacyId, invitationId);
            router.push(`/candidate/interview/${sessionId}`);
          }}
          className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950"
        >
          Continue to device check
        </button>
      )}
    </div>
  );
}
