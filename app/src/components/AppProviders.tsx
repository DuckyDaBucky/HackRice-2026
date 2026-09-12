"use client";

import { AuthProvider } from "./auth-provider";
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

  return <AuthProvider>{children}</AuthProvider>;
}
