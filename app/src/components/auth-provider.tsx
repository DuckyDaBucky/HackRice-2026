"use client";

import { ClerkProvider } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk";

export function AuthProvider({ children }: { children: React.ReactNode }) {
  if (!clerkEnabled) return <>{children}</>;
  return <ClerkProvider>{children}</ClerkProvider>;
}
