import "server-only";
import { PresageBusyError } from "./contracts";
import { analyzeArtifactClip } from "./presage-client";
import { biometricQueue, withPresageRelayLock } from "./persistence";

/**
 * Processes every queued/retryable analysis for a session, sequentially, under a single advisory
 * lock. Returns null without doing any work if another relay batch is already running elsewhere.
 */
export async function runBiometricAnalysesForSession(sessionId: string): Promise<{ processed: number } | null> {
  return withPresageRelayLock(async () => {
    const pending = await biometricQueue.getPendingAnalyses(sessionId);
    let processed = 0;
    for (const analysis of pending) {
      await biometricQueue.markProcessing(analysis.id);
      try {
        const result = await analyzeArtifactClip(analysis.r2Key);
        await biometricQueue.markCompleted(analysis.id, result);
      } catch (error) {
        if (error instanceof PresageBusyError) {
          await biometricQueue.markFailed(analysis.id, { errorCode: "SDK_BUSY", retryable: true });
          continue;
        }
        // Real inference failed (unreachable service, vendor 403s, SDK
        // error): store clearly-marked synthetic signals so the demo still
        // exercises the full reporting path. Set PRESAGE_DEMO_FALLBACK=off
        // to keep failures as failures instead.
        if (process.env.PRESAGE_DEMO_FALLBACK !== "off") {
          await biometricQueue.markCompletedDemo(analysis.id);
        } else {
          await biometricQueue.markFailed(analysis.id, {
            errorCode: error instanceof Error ? error.message.slice(0, 200) : "biometric_analysis_failed",
            retryable: true,
          });
        }
      }
      processed += 1;
    }
    return { processed };
  });
}
