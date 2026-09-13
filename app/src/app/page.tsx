import { Nav } from "@/components/marketing/Nav";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { TwoAudienceCards } from "@/components/marketing/TwoAudienceCards";
import { EmployerShowcase } from "@/components/marketing/EmployerShowcase";
import { TrustSection } from "@/components/marketing/TrustSection";
import { HowItWorks } from "@/components/marketing/HowItWorks";
import { FinalCta } from "@/components/marketing/FinalCta";
import { cookies } from "next/headers";
import { clerkEnabled } from "@/lib/clerk";
import { currentUser } from "@clerk/nextjs/server";
import { Dashboard } from "@/components/Dashboard";
import { HrDashboard } from "@/components/dashboard/HrDashboard";
import { getSessionStats, listRecentSessions, type SessionStats } from "@/lib/sessions";
import { getProfile } from "@/lib/profiles";
import { countUploadedAttemptsBySession } from "@/lib/answer-attempts";
import { resolveAppUserRole } from "@/lib/user-roles";
import { DASHBOARD_VIEW_COOKIE, resolveDashboardView } from "@/lib/dashboard/view-mode";
import { loadHrDashboardData } from "@/lib/hiring/hr-dashboard-data";

const EMPTY_STATS: SessionStats = { totalSessions: 0, completedSessions: 0, last7Days: 0 };

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

  const cookieStore = await cookies();
  let role: Awaited<ReturnType<typeof resolveAppUserRole>> = "candidate";
  try {
    role = await resolveAppUserRole(user.id);
  } catch (error) {
    console.error("Unable to resolve app user role, defaulting to candidate", error);
  }

  const dashboardView = resolveDashboardView(role, cookieStore.get(DASHBOARD_VIEW_COOKIE)?.value);

  if (dashboardView === "hr") {
    let hrData: Awaited<ReturnType<typeof loadHrDashboardData>> | null = null;
    try {
      hrData = await loadHrDashboardData();
    } catch (error) {
      console.error("HR dashboard unavailable, falling back to practice view", error);
    }

    if (hrData) {
      return (
        <HrDashboard
          firstName={user.firstName}
          role={role}
          dashboardView={dashboardView}
          orgName={hrData.org?.display_name ?? null}
          orgId={hrData.orgId}
          jobs={hrData.jobs}
          hiringEnabled={hrData.enabled}
        />
      );
    }
  }

  // The dashboard must never 500 when the database is unreachable (bad
  // DATABASE_URL, paused/deleted hosted service, network blip). Degrade to
  // an empty dashboard with a banner instead of crashing the homepage.
  let stats: SessionStats = EMPTY_STATS;
  let sessions: Awaited<ReturnType<typeof listRecentSessions>> = [];
  let profile: Awaited<ReturnType<typeof getProfile>> = null;
  let answeredCounts: Record<string, number> = {};
  let dbDown = false;
  try {
    const [loadedStats, loadedSessions, loadedProfile] = await Promise.all([
      getSessionStats(user.id),
      listRecentSessions(user.id),
      getProfile(user.id),
    ]);
    stats = loadedStats;
    sessions = loadedSessions;
    profile = loadedProfile;
    answeredCounts = await countUploadedAttemptsBySession(sessions.map((s) => s.id));
  } catch (error) {
    console.error("Dashboard database unavailable, rendering empty state", error);
    dbDown = true;
  }

  return (
    <>
      {dbDown && (
        <p role="alert" className="bg-amber-500/10 px-6 py-2 text-center text-sm text-amber-300">
          Session history is unavailable right now (database unreachable). You can still start a
          new practice session.
        </p>
      )}
      <Dashboard
        firstName={user.firstName}
        stats={stats}
        sessions={sessions}
        answeredCounts={answeredCounts}
        hasResume={profile !== null}
        role={role}
        dashboardView={dashboardView}
      />
    </>
  );
}
