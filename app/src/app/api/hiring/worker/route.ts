import { runProcessingWorker } from "@/lib/processing/worker";
import { processSolanaOutboxBatch } from "@/lib/solana/outbox";
import { hiringEnabled } from "@/lib/hiring/config";

export async function POST(request: Request) {
  if (!hiringEnabled()) {
    return Response.json({ error: "Hiring flow disabled" }, { status: 503 });
  }
  const secret = request.headers.get("x-worker-secret");
  if (process.env.HIRING_WORKER_SECRET && secret !== process.env.HIRING_WORKER_SECRET) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const processed = await runProcessingWorker(10);
  const solana = await processSolanaOutboxBatch(10);
  return Response.json({ processed, solana });
}
