"use client";

import { ClerkProvider } from "@clerk/nextjs";
import type { ReactNode } from "react";

/** All persisted interview routes use Clerk-backed Server Actions. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <ClerkProvider>{children}</ClerkProvider>;
}
