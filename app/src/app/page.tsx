import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { TwoAudienceCards } from "@/components/marketing/TwoAudienceCards";
import { EmployerShowcase } from "@/components/marketing/EmployerShowcase";
import { TrustSection } from "@/components/marketing/TrustSection";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { WaitlistCta } from "@/components/marketing/WaitlistCta";
import { clerkEnabled } from "@/lib/clerk";
import { currentUser } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/Dashboard";
import { getSessionStats, listRecentSessions } from "@/lib/sessions";
import { getProfile } from "@/lib/profiles";
import { USE_MOCK_DASHBOARD_DATA, MOCK_STATS, MOCK_SESSIONS, MOCK_HAS_RESUME } from "@/lib/dashboard/mock-data";

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
        <WaitlistCta />
        <Footer />
      </div>
    );
  }

  const [stats, sessions, profile] = USE_MOCK_DASHBOARD_DATA
    ? [MOCK_STATS, MOCK_SESSIONS, null]
    : await Promise.all([getSessionStats(user.id), listRecentSessions(user.id), getProfile(user.id)]);

  return (
    <Dashboard
      firstName={user.firstName}
      stats={stats}
      sessions={sessions}
      hasResume={USE_MOCK_DASHBOARD_DATA ? MOCK_HAS_RESUME : profile !== null}
    />
  );
}
