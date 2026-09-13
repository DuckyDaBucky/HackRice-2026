"use client";

import { useClerk, useUser } from "@clerk/nextjs";

/** Account section: identity at a glance, full Clerk management one click away. */
export function AccountSettings() {
  const { user } = useUser();
  const { openUserProfile } = useClerk();

  if (!user) return null;
  const email = user.primaryEmailAddress?.emailAddress ?? "No email on file";

  return (
    <section aria-labelledby="settings-account" className="flex flex-col gap-3">
      <h2 id="settings-account" className="text-[13px] font-semibold uppercase tracking-wide text-dash-text-muted">
        Account
      </h2>
      <div className="flex flex-col gap-4 rounded-xl border border-dash-border bg-dash-surface p-5 sm:flex-row sm:items-center">
        {user.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={user.imageUrl}
            alt={`${user.fullName ?? "Your"} profile photo`}
            width={56}
            height={56}
            className="h-14 w-14 shrink-0 rounded-full"
          />
        ) : (
          <span aria-hidden="true" className="h-14 w-14 shrink-0 rounded-full bg-dash-border" />
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-base font-semibold text-dash-text">{user.fullName ?? "Your account"}</p>
          <p className="truncate text-sm text-dash-text-muted">{email}</p>
        </div>
        <button
          type="button"
          onClick={() => void openUserProfile()}
          className="inline-flex h-9 shrink-0 items-center rounded-md border border-dash-border-strong px-4 text-sm font-medium text-dash-text transition-colors duration-150 hover:bg-dash-surface-hover"
        >
          Full account settings
        </button>
      </div>
      <p className="text-xs leading-relaxed text-dash-text-faint">
        Password, multi-factor authentication, and connected accounts live in the full account settings.
      </p>
    </section>
  );
}
