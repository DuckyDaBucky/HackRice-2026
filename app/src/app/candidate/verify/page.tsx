import { Suspense } from "react";
import { CandidateVerifyContent } from "@/components/hiring/CandidateVerifyContent";

export default function CandidateVerifyPage() {
  return (
    <Suspense fallback={<div className="flex min-h-[100dvh] items-center justify-center bg-zinc-950 text-zinc-400">Loading…</div>}>
      <CandidateVerifyContent />
    </Suspense>
  );
}
