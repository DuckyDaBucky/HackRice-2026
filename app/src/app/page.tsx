import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { TwoAudienceCards } from "@/components/marketing/TwoAudienceCards";
import { EmployerShowcase } from "@/components/marketing/EmployerShowcase";
import { TrustSection } from "@/components/marketing/TrustSection";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FinalCta } from "@/components/marketing/FinalCta";
import { clerkEnabled } from "@/lib/clerk";
import { currentUser } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/Dashboard";
import { getSessionStats, listRecentSessions } from "@/lib/sessions";
import { getProfile } from "@/lib/profiles";
import { countUploadedAttemptsBySession } from "@/lib/answer-attempts";

export default async function Home() {
  const user = clerkEnabled ? await currentUser() : null;

  if (!user) {
    return (
      <div className="marketing">
        <Nav />
        <Hero />
        <TwoAudienceCards />
        <EmployerShowcase />
        <TrustSection />
        <HowItWorks />
        <FinalCta />
        <Footer />
      </div>
    );
  }

  const [stats, sessions, profile] = await Promise.all([
    getSessionStats(user.id),
    listRecentSessions(user.id),
    getProfile(user.id),
  ]);
  const answeredCounts = await countUploadedAttemptsBySession(sessions.map((s) => s.id));

  return (
    <Dashboard
      firstName={user.firstName}
      stats={stats}
      sessions={sessions}
      answeredCounts={answeredCounts}
      hasResume={profile !== null}
    />
  );
}
