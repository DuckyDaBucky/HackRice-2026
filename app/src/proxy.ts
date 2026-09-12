import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPersistedInterviewRoute = createRouteMatcher([
  "/interview/setup(.*)",
  "/interview/session(.*)",
]);

export default clerkMiddleware(async (auth, request) => {
  if (isPersistedInterviewRoute(request)) await auth.protect();
});

export const config = {
  matcher: [
    // Every App Router page or server action that calls auth() must pass
    // through Clerk. Individual routes can still be public; this matcher only
    // establishes Clerk's request context.
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/api/(.*)",
    "/trpc(.*)",
  ],
};
