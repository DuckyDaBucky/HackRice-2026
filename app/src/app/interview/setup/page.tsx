import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { InterviewSetupForm } from "@/components/dashboard/InterviewSetupForm";

export default async function InterviewSetupPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Finterview%2Fsetup");

  return (
    <DashboardShell active="Practice" firstName={user.firstName}>
      <InterviewSetupForm />
    </DashboardShell>
  );
}
