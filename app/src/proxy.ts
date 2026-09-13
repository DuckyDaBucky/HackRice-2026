import { NextResponse, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isPersistedInterviewRoute = createRouteMatcher([
  "/interview/setup(.*)",
  "/interview/session(.*)",
]);

const isAuthPage = createRouteMatcher([
  "/sign-in(.*)",
  "/sign-up(.*)",
  "/login(.*)",
]);

const withClerk = clerkMiddleware(async (auth, request) => {
  if (isAuthPage(request)) {
    const { userId } = await auth();
    if (userId) {
      const redirectUrl = request.nextUrl.searchParams.get("redirect_url");
      const dest = redirectUrl?.startsWith("/") ? redirectUrl : "/";
      return NextResponse.redirect(new URL(dest, request.url));
    }
  }
  if (isPersistedInterviewRoute(request)) await auth.protect();
});

const withoutClerk = (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "development" && (path === "/dev" || path.startsWith("/dev/") || path.startsWith("/api/dev/"))) return new NextResponse(null, { status: 404 });
  if (path === "/dev" || path.startsWith("/dev/") || path.startsWith("/api/") || path.startsWith("/trpc")) {
    return NextResponse.json({ error: { message: "Configure Clerk to access authenticated features." } }, { status: 503 });
  }
  return NextResponse.next();
};

export default clerkEnabled ? withClerk : withoutClerk;

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
