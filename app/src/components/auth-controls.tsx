"use client";

import { SignInButton, SignUpButton, Show, UserButton } from "@clerk/nextjs";
import { clerkEnabled } from "@/lib/clerk";

export function AuthControls() {
  if (!clerkEnabled) return null;
  return (
    <>
      <Show when="signed-out">
        <SignInButton />
        <SignUpButton />
      </Show>
      <Show when="signed-in">
        <UserButton />
      </Show>
    </>
  );
}
