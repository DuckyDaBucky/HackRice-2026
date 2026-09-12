import { currentUser } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/Dashboard";
import { getSessionStats, listRecentSessions } from "@/lib/sessions";
import { countUploadedAttemptsBySession } from "@/lib/answer-attempts";

export default async function Home() {
  const user = await currentUser();

  if (!user) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 text-center">
        <h1 className="text-3xl font-semibold">HackRice 2026</h1>
        <p className="text-zinc-400">Sign in or sign up to get started.</p>
      </div>
    );
  }

  const [stats, sessions] = await Promise.all([
    getSessionStats(user.id),
    listRecentSessions(user.id),
  ]);
  const answeredCounts = await countUploadedAttemptsBySession(sessions.map((s) => s.id));

  return (
    <Dashboard
      firstName={user.firstName}
      stats={stats}
      sessions={sessions}
      answeredCounts={answeredCounts}
    />
  );
}
