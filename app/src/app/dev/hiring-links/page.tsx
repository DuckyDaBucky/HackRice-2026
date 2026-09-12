import Link from "next/link";
import { auth, currentUser } from "@clerk/nextjs/server";
import { seedDemoHiringLinks } from "@/lib/hiring/demo-seed";
import { hiringEnabled } from "@/lib/hiring/config";

export const dynamic = "force-dynamic";

export default async function DevHiringLinksPage() {
  if (!hiringEnabled()) {
    return <p className="p-8 text-zinc-400">Set HIRING_ENABLED=true to use demo hiring links.</p>;
  }

  const user = await currentUser();
  const { userId } = await auth();
  const origin = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const email = user?.emailAddresses.find((e) => e.verification?.status === "verified")?.emailAddress;

  const demo = await seedDemoHiringLinks({
    origin,
    clerkUserId: userId ?? undefined,
    candidateEmail: email ?? "demo.candidate@example.com",
    candidateName: user?.firstName ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Demo Candidate",
  });

  return (
    <div className="mx-auto max-w-3xl px-6 py-12 text-zinc-200">
      <h1 className="text-2xl font-semibold text-zinc-50">Demo hiring links</h1>
      <p className="mt-2 text-sm text-zinc-400">
        Real seeded sessions — resume-based questions for <strong>{demo.jobTitle}</strong>.
        Persona/interview use your email: <code className="text-sky-300">{demo.candidateEmail}</code>
        {" · "}
        Invite flow uses: <code className="text-sky-300">{demo.inviteEmail}</code>
      </p>
      {!userId && (
        <p className="mt-4 rounded border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          Sign in to unlock the interview room link (uses your Clerk account).
        </p>
      )}

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">HR</h2>
        <LinkList links={[
          { label: "Hiring workspace", href: demo.links.hr },
          { label: "Demo job", href: demo.links.hrJob },
        ]} />
      </section>

      <section className="mt-8 space-y-4">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">Candidate flow</h2>
        <LinkList links={[
          { label: "1. Accept invite (fresh)", href: demo.links.invite },
          { label: "2. Persona verify page", href: demo.links.personaVerify },
          ...(demo.links.personaHosted ? [{ label: "2b. Persona hosted UI", href: demo.links.personaHosted }] : []),
          ...(demo.links.interview ? [{ label: "3. Interview room (ready)", href: demo.links.interview }] : []),
          ...(demo.links.feedback ? [{ label: "4. Candidate feedback", href: demo.links.feedback }] : []),
        ]} />
      </section>

      <section className="mt-8">
        <h2 className="text-sm font-medium tracking-wide text-zinc-500 uppercase">Question pack preview</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-zinc-300">
          {demo.questions.map((q) => (
            <li key={q.id}>
              <span className="text-zinc-500">[{q.category}] </span>
              {q.prompt}
            </li>
          ))}
        </ol>
      </section>

      <p className="mt-8 text-xs text-zinc-500">{demo.note}</p>
    </div>
  );
}

function LinkList({ links }: { links: Array<{ label: string; href: string }> }) {
  return (
    <ul className="space-y-2">
      {links.map((link) => (
        <li key={link.href}>
          <Link href={link.href} className="text-sky-400 underline hover:text-sky-300">
            {link.label}
          </Link>
          <div className="truncate text-xs text-zinc-600">{link.href}</div>
        </li>
      ))}
    </ul>
  );
}
