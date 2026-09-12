import "server-only";
import { auth } from "@clerk/nextjs/server";
import { WorkbenchError } from "./errors";
export async function requireDevUser() {
  if (process.env.NODE_ENV !== "development") throw new WorkbenchError("NOT_FOUND", "Not found", 404);
  const { userId } = await auth();
  if (!userId) throw new WorkbenchError("UNAUTHENTICATED", "Sign in to use the workbench.", 401);
  return userId;
}
export function checkOrigin(request: Request) {
  if (request.headers.get("origin") !== new URL(request.url).origin)
    throw new WorkbenchError("ORIGIN", "Open the workbench on this server before submitting.", 403);
}
