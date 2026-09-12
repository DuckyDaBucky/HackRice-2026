"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

/**
 * Practice interviews are intentionally public in the current demo and do
 * not read Clerk state. Keeping them outside Clerk also means an expired or
 * mismatched development session cannot prevent camera access.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  if (pathname.startsWith("/interview")) {
    return children;
  }

  return <ClerkProvider>{children}</ClerkProvider>;
}
