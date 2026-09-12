"use client";

import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

/** Hidden on /interview routes: the call UI is full-bleed and owns its own header. */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview")) return null;

  return (
    <header className="flex items-center justify-between gap-4 px-6 py-4">
      <span className="text-sm font-medium tracking-tight text-zinc-100">HackRice</span>
      <div className="flex items-center gap-3">
        <Show when="signed-out">
          <SignInButton>
            <button
              type="button"
              className="rounded-full px-4 py-1.5 text-sm font-medium text-zinc-300 transition hover:text-zinc-50"
            >
              Sign in
            </button>
          </SignInButton>
          <SignUpButton>
            <button
              type="button"
              className="rounded-full bg-zinc-100 px-4 py-1.5 text-sm font-medium text-zinc-950 transition hover:bg-white"
            >
              Sign up
            </button>
          </SignUpButton>
        </Show>
        <Show when="signed-in">
          <UserButton />
        </Show>
      </div>
    </header>
  );
}
