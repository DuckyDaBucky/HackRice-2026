"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  candidateStartPersona,
  candidateGetVerificationStatus,
  candidateEnterInterview,
  candidateConfirmSandboxIdentity,
} from "@/app/candidate/actions";

export function CandidateVerifyContent() {
  const router = useRouter();
  const params = useSearchParams();
  const candidacyId = params.get("candidacy") ?? "";
  const invitationId = params.get("invitation") ?? "";
  const [status, setStatus] = useState<string>("pending");
  const [sandboxLabel, setSandboxLabel] = useState("");
  const [sandboxBypass, setSandboxBypass] = useState(false);
  const [personaAvailable, setPersonaAvailable] = useState(false);
  const [inquiryUrl, setInquiryUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!candidacyId || !invitationId) return;
    const refresh = () => {
      void candidateGetVerificationStatus(candidacyId).then((s) => {
        setStatus(s.candidacyStatus ?? s.verificationStatus);
        setSandboxBypass(Boolean(s.sandboxBypass));
        setPersonaAvailable(Boolean(s.personaAvailable));
      });
    };
    refresh();
    const interval = setInterval(refresh, 3000);
    return () => clearInterval(interval);
  }, [candidacyId, invitationId]);

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-50">Identity verification</h1>
      <p className="text-sm leading-relaxed text-zinc-400">
        {sandboxBypass
          ? "Fallback only: confirm the recruiter-bound email in sandbox. For the Persona demo, complete real ID verification via the button below."
          : "Complete government ID and selfie verification before your interview. Access is granted only after Persona confirms the inquiry via webhook."}
        {sandboxLabel}
      </p>
      {personaAvailable && (
        <button
          type="button"
          onClick={async () => {
            try {
              const result = await candidateStartPersona(invitationId, candidacyId);
              setSandboxLabel(result.sandboxLabel);
              setInquiryUrl(result.inquiryUrl);
              window.open(result.inquiryUrl, "_blank", "noopener,noreferrer");
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Persona not configured");
            }
          }}
          className="rounded-full border border-zinc-700 px-6 py-3 text-sm text-zinc-200 hover:bg-zinc-900"
        >
          Start Persona verification
        </button>
      )}
      {inquiryUrl && (
        <a
          href={inquiryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-sm text-sky-400 underline"
        >
          Re-open Persona verification
        </a>
      )}
      {sandboxBypass && (
        <button
          type="button"
          onClick={async () => {
            try {
              await candidateConfirmSandboxIdentity(invitationId, candidacyId);
              setStatus("verified");
              setError(null);
            } catch (e) {
              setError(e instanceof Error ? e.message : "Sandbox confirmation failed");
            }
          }}
          className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950"
        >
          Confirm sandbox identity
        </button>
      )}
      {error && <p className="text-sm text-red-300">{error}</p>}
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
