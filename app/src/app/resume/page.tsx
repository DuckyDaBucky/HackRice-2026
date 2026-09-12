import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { FileTextIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getProfile } from "@/lib/profiles";

const LEVEL_LABEL: Record<string, string> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  unknown: "Not yet classified",
};

export default async function ResumePage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fresume");

  const account = await getProfile(user.id);

  return (
    <DashboardShell active="Resume" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1120] sm:text-3xl">
            Resume
          </h1>
          <p className="text-sm text-[#5b6474]">
            Your resume is what makes practice questions specific to you.
          </p>
        </div>

        {account ? (
          <div className="flex flex-col gap-5 rounded-2xl border border-[#eef1f6] bg-white p-6">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#e9f6f1] text-[#0f9d78]">
                <FileTextIcon size={18} weight="light" />
              </span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-[#0b1120]">Profile on file</span>
                <span className="text-xs text-[#93a1b5]">
                  Last updated{" "}
                  {new Date(account.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <SummaryStat label="Experience level" value={LEVEL_LABEL[account.profile.experienceLevel]} />
              <SummaryStat label="Projects" value={String(account.profile.projects.length)} />
              <SummaryStat label="Skills tracked" value={String(account.profile.skills.length)} />
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e3e7ee] bg-white px-6 py-14 text-center">
            <FileTextIcon size={28} weight="light" className="text-[#c4cbd6]" />
            <p className="text-sm text-[#5b6474]">You haven&rsquo;t added a resume yet.</p>
          </div>
        )}

        <p className="text-xs text-[#93a1b5]">
          Resume upload and editing from your dashboard is coming soon — for now this reflects
          whatever profile has been parsed for your account.
        </p>
      </div>
    </DashboardShell>
  );
}

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[#f4f5f7] px-4 py-3">
      <div className="text-base font-semibold text-[#0b1120]">{value}</div>
      <div className="text-xs text-[#5b6474]">{label}</div>
    </div>
  );
}
