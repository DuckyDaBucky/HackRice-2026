import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware();

export const config = {
  matcher: [
    // The practice interview is public and has no Clerk data dependency.
    // Excluding it entirely also prevents stale development auth cookies
    // from redirect-looping before the camera UI can load.
    "/((?!_next|interview(?:/|$)|api/interview(?:/|$)|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/api/((?!interview(?:/|$)).*)",
    "/trpc(.*)",
  ],
};
