import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { FileArrowUpIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";
import { getDashboardShellContext } from "@/lib/dashboard/shell-props";
import { ResumeUploadButton } from "@/components/dashboard/ResumeUploadButton";
import { getProfile } from "@/lib/profiles";

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

  const account = await getProfile(user.id);
  const shell = await getDashboardShellContext(user.id);

  return (
    <DashboardShell active="Resume" firstName={user.firstName} role={shell.role} dashboardView={shell.dashboardView}>
      <div className="mx-auto flex w-full max-w-[1120px] flex-col gap-8">
        {!account ? (
          <>
            <div>
              <h1 className="text-[28px] font-semibold tracking-tight text-dash-text">Resume</h1>
              <p className="mt-1 text-sm text-dash-text-muted">
                Personalize your interviews using your experience.
              </p>
            </div>
            <div className="flex flex-col items-center gap-1.5 rounded-xl border border-dashed border-dash-border-strong bg-dash-surface-hover px-8 py-12 text-center transition-colors duration-150 hover:border-accent/50 hover:bg-dash-nav-active">
              <FileArrowUpIcon size={26} weight="light" className="text-dash-text-faint" />
              <h2 className="mt-1.5 text-base font-semibold text-dash-text">Add your resume</h2>
              <p className="max-w-sm text-sm text-dash-text-muted">
                We&rsquo;ll use your experience and skills to personalize your interview questions.
              </p>
              <div className="mt-3.5">
                <ResumeUploadButton label="Choose resume" />
              </div>
              <p className="mt-1 text-xs text-dash-text-faint">PDF or DOCX · Max 10 MB</p>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-dash-text-faint">
                  Last updated{" "}
                  {new Date(account.updatedAt).toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                  })}
                </p>
                <h1 className="mt-1 text-[28px] font-semibold tracking-tight text-dash-text">
                  {user.fullName ?? user.firstName ?? "Your profile"}
                </h1>
                <p className="mt-0.5 text-sm text-dash-text-muted">
                  {LEVEL_LABEL[account.profile.experienceLevel]}
                </p>
              </div>
              <ResumeUploadButton label="Replace resume" variant="outline" />
            </div>

            {account.profile.skills.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Skills
                </h2>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {account.profile.skills.map((skill) => (
                    <span
                      key={skill}
                      className="rounded-md border border-dash-border-strong bg-dash-surface-hover px-2.5 py-1 text-xs font-medium text-dash-text"
                    >
                      {skill}
                    </span>
                  ))}
                </div>
              </section>
            )}

            {account.profile.projects.length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Projects
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-dash-border rounded-xl border border-dash-border bg-dash-surface">
                  {account.profile.projects.map((project) => (
                    <li key={project.id} className="px-4 py-3">
                      <div className="text-sm font-medium text-dash-text">{project.name}</div>
                      {project.description && (
                        <p className="mt-0.5 text-sm text-dash-text-muted">{project.description}</p>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {account.profile.sections.filter((s) => s.kind !== EDUCATION_KIND).length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Experience
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-dash-border rounded-xl border border-dash-border bg-dash-surface">
                  {account.profile.sections
                    .filter((s) => s.kind !== EDUCATION_KIND)
                    .map((section, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="text-sm font-medium text-dash-text">
                          {section.title}
                          {section.organization ? ` · ${section.organization}` : ""}
                        </div>
                        {section.dates && (
                          <div className="mt-0.5 text-xs text-dash-text-faint">{section.dates}</div>
                        )}
                      </li>
                    ))}
                </ul>
              </section>
            )}

            {account.profile.sections.filter((s) => s.kind === EDUCATION_KIND).length > 0 && (
              <section>
                <h2 className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
                  Education
                </h2>
                <ul className="mt-3 flex flex-col divide-y divide-dash-border rounded-xl border border-dash-border bg-dash-surface">
                  {account.profile.sections
                    .filter((s) => s.kind === EDUCATION_KIND)
                    .map((section, i) => (
                      <li key={i} className="px-4 py-3">
                        <div className="text-sm font-medium text-dash-text">
                          {section.title}
                          {section.organization ? ` · ${section.organization}` : ""}
                        </div>
                        {section.dates && (
                          <div className="mt-0.5 text-xs text-dash-text-faint">{section.dates}</div>
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
