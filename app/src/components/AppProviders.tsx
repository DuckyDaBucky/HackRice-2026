"use client";

import { AuthProvider } from "./auth-provider";
import type { ReactNode } from "react";

/** All persisted interview routes use Clerk-backed Server Actions. */
export function AppProviders({ children }: { children: ReactNode }) {
  return <AuthProvider>{children}</AuthProvider>;
}
