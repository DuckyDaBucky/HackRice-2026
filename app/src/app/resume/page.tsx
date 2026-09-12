import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { FileArrowUpIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { ResumeUploadButton } from "@/components/dashboard/ResumeUploadButton";
import { getProfile } from "@/lib/profiles";
import { USE_MOCK_DASHBOARD_DATA, MOCK_PROFILE_ACCOUNT } from "@/lib/dashboard/mock-data";

const LEVEL_LABEL: Record<string, string> = {
  intern: "Intern",
  entry: "Entry level",
  mid: "Mid level",
  senior: "Senior",
  unknown: "Experience level not yet classified",
};

const EDUCATION_KIND = "education";

export default async function ResumePage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fresume");

  const account = USE_MOCK_DASHBOARD_DATA ? MOCK_PROFILE_ACCOUNT : await getProfile(user.id);

  return (
    <DashboardShell active="Resume" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        {!account ? (
          <>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-[#0b1120]">Resume</h1>
              <p className="mt-1 text-sm text-[#6b7280]">
                Personalize your interviews using your experience.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-[#d8dee7] bg-[#fbfcfc] px-8 py-12 text-center transition-colors duration-150 hover:border-accent/50 hover:bg-[#f8fefc]">
              <FileArrowUpIcon size={26} weight="light" className="text-[#93a1b5]" />
              <h2 className="mt-1.5 text-base font-semibold text-[#0b1120]">Add your resume</h2>
              <p className="max-w-sm text-sm text-[#6b7280]">
                We&rsquo;ll use your experience and skills to personalize your interview questions.
              </p>
              <div className="mt-3.5">
                <ResumeUploadButton label="Choose resume" />
              </div>
              <p className="mt-1 text-xs text-[#93a1b5]">PDF or DOCX · Max 10 MB</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-[#93a1b5]">
                  Last updated{" "}
                  {new Date(account.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-[#0b1120]">
                  {user.fullName ?? user.firstName ?? "Your profile"}
                </h1>
                <p className="mt-0.5 text-sm text-[#6b7280]">
                  {LEVEL_LABEL[account.profile.experienceLevel]}
                </p>
              </div>
              <ResumeUploadButton label="Replace resume" variant="outline" />
            </div>

            {account.profile.skills.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Skills
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {account.profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-[#e3e7ee] bg-[#f9fafb] px-2.5 py-1 text-xs font-medium text-[#0b1120]"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {account.profile.projects.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Projects
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-[#eef1f6] rounded-xl border border-[#eef1f6] bg-white">
                  {account.profile.projects.map((project) => (
                    <li key={project.id} className="px-4 py-3">
                      <div className="text-sm font-medium text-[#0b1120]">{project.name}</div>
                      {project.description && (
                        <p className="mt-0.5 text-sm text-[#5b6474]">{project.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {account.profile.sections.filter((s) => s.kind !== EDUCATION_KIND).length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Experience
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-[#eef1f6] rounded-xl border border-[#eef1f6] bg-white">
                  {account.profile.sections
                    .filter((s) => s.kind !== EDUCATION_KIND)
                    .map((section, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0b1120]">
                          {section.title}
                          {section.organization ? ` · ${section.organization}` : ""}
                        </div>
                        {section.dates && (
                          <div className="mt-0.5 text-xs text-[#93a1b5]">{section.dates}</div>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {account.profile.sections.filter((s) => s.kind === EDUCATION_KIND).length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-[#6b7280]">
                  Education
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-[#eef1f6] rounded-xl border border-[#eef1f6] bg-white">
                  {account.profile.sections
                    .filter((s) => s.kind === EDUCATION_KIND)
                    .map((section, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="text-sm font-medium text-[#0b1120]">
                          {section.title}
                          {section.organization ? ` · ${section.organization}` : ""}
                        </div>
                        {section.dates && (
                          <div className="mt-0.5 text-xs text-[#93a1b5]">{section.dates}</div>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            )}
          </>
        )}
      </div>
    </DashboardShell>
  );
}
