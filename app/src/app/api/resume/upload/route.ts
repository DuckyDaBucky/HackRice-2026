import { auth } from "@clerk/nextjs/server";
import { checkOrigin } from "@/lib/workbench/access";
import { extractResume, MAX_UPLOAD } from "@/lib/workbench/extraction";
import { parseResume } from "@/lib/workbench/parser";
import { classifyExperience, classificationDate } from "@/lib/workbench/experience";
import { getProfile, saveProfile } from "@/lib/profiles";
import { WorkbenchError } from "@/lib/workbench/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const json = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });

function failure(e: unknown) {
  if (e instanceof WorkbenchError) return json({ error: { message: e.message } }, e.status);
  return json({ error: { message: "Could not process this resume. Try again." } }, 500);
}

async function readBody(request: Request, limit: number) {
  if (Number(request.headers.get("content-length")) > limit)
    throw new WorkbenchError("TOO_LARGE", "File exceeds the allowed size.", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new WorkbenchError("EMPTY", "No file received.");
  let size = 0;
  const parts: Uint8Array[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > limit) {
        await reader.cancel();
        throw new WorkbenchError("TOO_LARGE", "File exceeds the allowed size.", 413);
      }
      parts.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  return Buffer.concat(parts);
}

/** Real upload → parse → classify → save, reusing the same workbench pipeline as /dev, just gated by normal sign-in instead of the dev-only workbench. */
export async function POST(request: Request) {
  try {
    const { userId } = await auth();
    if (!userId) return json({ error: { message: "Sign in to upload a resume." } }, 401);
    checkOrigin(request);

    const buffer = await readBody(request, MAX_UPLOAD);
    const filename = request.headers.get("x-file-name") || "";
    const { text } = await extractResume(buffer, filename);
    const { profile } = await parseResume(text);
    const classified = await classifyExperience(profile);
    const existing = await getProfile(userId);
    const account = await saveProfile(userId, { ...profile, ...classified }, existing?.version ?? null);
    return json({ account, analysisDate: classificationDate() });
  } catch (e) {
    return failure(e);
  }
}
