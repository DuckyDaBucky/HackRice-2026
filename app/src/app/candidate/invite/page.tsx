"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { candidateExchangeInvitation, candidateBindEmail } from "../actions";

export default function CandidateInvitePage() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const [status, setStatus] = useState<"loading" | "ready" | "error" | "redirecting">("loading");
  const [details, setDetails] = useState<{ invitationId: string; candidacyId: string; jobTitle: string; orgName: string; sandboxLabel: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (!hash) {
      setStatus("error");
      setError("Missing invitation link.");
      return;
    }
    history.replaceState(null, "", window.location.pathname);
    void candidateExchangeInvitation(hash)
      .then(async (d) => {
        setDetails(d);
        sessionStorage.setItem("hiring_invitation_id", d.invitationId);
        sessionStorage.setItem("hiring_candidacy_id", d.candidacyId);
        if (isSignedIn) {
          setStatus("redirecting");
          try {
            await candidateBindEmail(d.invitationId);
            router.replace(`/candidate/verify?candidacy=${d.candidacyId}&invitation=${d.invitationId}`);
            return;
          } catch {
            setStatus("ready");
            return;
          }
        }
        setStatus("ready");
      })
      .catch((e) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Invalid invitation");
      });
  }, [isSignedIn, router]);

  if (status === "loading" || status === "redirecting") {
    return (
      <div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">
        Validating invitation…
      </div>
    );
  }

  if (status === "error" || !details) {
    return (
      <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-4 px-6 py-12 text-zinc-200">
        <h1 className="text-2xl font-semibold text-zinc-50">Invitation unavailable</h1>
        <p className="text-sm text-red-300">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-[100dvh] max-w-lg flex-col justify-center gap-6 px-6 py-12">
      <span className="text-xs font-medium tracking-wide text-sky-400 uppercase">Employer interview</span>
      <h1 className="text-3xl font-semibold tracking-tight text-zinc-50">{details.jobTitle}</h1>
      <p className="text-base leading-relaxed text-zinc-400">
        {details.orgName} invited you to a recorded interview. Sign in with the email your recruiter confirmed, then complete identity verification.
        {details.sandboxLabel}
      </p>
      <button
        type="button"
        onClick={async () => {
          try {
            await candidateBindEmail(details.invitationId);
            router.push(`/candidate/verify?candidacy=${details.candidacyId}&invitation=${details.invitationId}`);
          } catch (e) {
            setError(e instanceof Error ? e.message : "Sign in failed");
            router.push(`/sign-in?redirect_url=${encodeURIComponent(window.location.pathname)}`);
          }
        }}
        className="rounded-full bg-sky-500 px-6 py-3 text-sm font-medium text-zinc-950 transition active:scale-[0.98]"
      >
        Continue with verified email
      </button>
    </div>
  );
}
