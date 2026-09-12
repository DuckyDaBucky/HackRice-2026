// Lets the app run locally before Clerk keys are configured. Once
// NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is set, auth turns back on automatically.
export const clerkEnabled = Boolean(
  process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY,
);
