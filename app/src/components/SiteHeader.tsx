"use client";

import { usePathname } from "next/navigation";
import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";

/** Hidden on /interview routes: the call UI is full-bleed and owns its own header. */
export function SiteHeader() {
  const pathname = usePathname();
  if (pathname.startsWith("/interview")) return null;

  return (
    <header className="flex items-center justify-end gap-4 p-4">
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </header>
  );
}
