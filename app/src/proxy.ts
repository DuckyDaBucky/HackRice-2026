import { NextResponse, type NextRequest } from "next/server";
import { clerkEnabled } from "@/lib/clerk";
import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkEnabled ? clerkMiddleware() : (request: NextRequest) => {
  const path = request.nextUrl.pathname;
  if (process.env.NODE_ENV !== "development" && (path === "/dev" || path.startsWith("/dev/") || path.startsWith("/api/dev/"))) return new NextResponse(null, { status: 404 });
  if (path === "/dev" || path.startsWith("/dev/") || path.startsWith("/api/") || path.startsWith("/trpc")) {
    return NextResponse.json({ error: { message: "Configure Clerk to access authenticated features." } }, { status: 503 });
  }
  return NextResponse.next();
};

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
