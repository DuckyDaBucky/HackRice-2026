import { redirect } from "next/navigation";
import { currentUser } from "@clerk/nextjs/server";
import { BooksIcon } from "@phosphor-icons/react/ssr";
import { clerkEnabled } from "@/lib/clerk";
import { DashboardShell } from "@/components/dashboard/DashboardShell";

export default async function ResourcesPage() {
  if (!clerkEnabled) redirect("/");
  const user = await currentUser();
  if (!user) redirect("/sign-in?redirect_url=%2Fresources");

  return (
    <DashboardShell active="Resources" firstName={user.firstName}>
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight text-[#0b1120] sm:text-3xl">
            Resources
          </h1>
          <p className="text-sm text-[#5b6474]">
            Guides, sample questions, and interview tips.
          </p>
        </div>

        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-[#e3e7ee] bg-white px-6 py-14 text-center">
          <BooksIcon size={28} weight="light" className="text-[#c4cbd6]" />
          <p className="text-sm text-[#5b6474]">
            We&rsquo;re still writing this library. Check back soon.
          </p>
        </div>
      </div>
    </DashboardShell>
  );
}
