import { mkdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";

import type { FastifyInstance } from "fastify";

import { errorBody } from "../errors.js";
import {
  createR2Fetcher,
  downloadR2Object,
  validateR2Key,
  type R2Fetcher,
} from "../r2.js";
import {
  analyzeLocalFile,
  safeExtension,
  type VideoQuery,
  type VideoRouteDependencies,
} from "./video-analysis.js";

export interface R2VideoRouteDependencies extends VideoRouteDependencies {
  r2Fetcher?: R2Fetcher | undefined;
}

interface R2VideoBody {
  key?: unknown;
}

function routeErrorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

/**
 * Analyzes a prerecorded video fetched server-side from R2. The client sends
 * JSON (`{ "key": "interviews/<session>/<question>.mp4" }`) after uploading
 * the bytes straight to R2, so no video payload crosses the Cloudflare
 * tunnel request path. Analysis options ride the same query string as the
 * multipart route.
 */
export async function registerR2VideoRoute(
  app: FastifyInstance,
  dependencies: R2VideoRouteDependencies,
): Promise<void> {
  const { config } = dependencies;

  app.post<{ Querystring: VideoQuery; Body: R2VideoBody }>(
    "/v1/videos/analyze-r2",
    async (request, reply) => {
      const analysisId = randomUUID();
      if (!config.r2) {
        return reply
          .code(503)
          .send(
            errorBody(
              "R2_NOT_CONFIGURED",
              "The service has no R2 bucket configured",
              false,
              request.id,
            ),
          );
      }

      let key: string;
      try {
        key = validateR2Key(request.body?.key, config.r2.keyPrefix);
      } catch (error) {
        const message = error instanceof Error ? error.message : "The R2 object key is not allowed";
        return reply.code(400).send(errorBody("R2_KEY_INVALID", message, false, request.id));
      }

      const uploadDirectory = join(tmpdir(), "presage-api-uploads");
      await mkdir(uploadDirectory, { recursive: true });
      const uploadPath = join(uploadDirectory, `${analysisId}${safeExtension(key)}`);

      try {
        const fetcher = dependencies.r2Fetcher ?? createR2Fetcher(config);
        await downloadR2Object(fetcher, config.r2.bucket, key, uploadPath, config.maxVideoBytes);
      } catch (error) {
        await rm(uploadPath, { force: true });
        const code = routeErrorCode(error);
        if (code === "VIDEO_TOO_LARGE") {
          return reply
            .code(413)
            .send(
              errorBody("VIDEO_TOO_LARGE", "The R2 object exceeds MAX_VIDEO_BYTES", false, request.id),
            );
        }
        if (code === "R2_KEY_NOT_FOUND") {
          return reply
            .code(404)
            .send(errorBody("R2_KEY_NOT_FOUND", "The R2 object does not exist", false, request.id));
        }
        request.log.error({ err: error, analysisId }, "R2 video fetch failed");
        return reply
          .code(502)
          .send(errorBody("R2_FETCH_FAILED", "Could not fetch the video from R2", true, request.id));
      }

      return analyzeLocalFile(
        dependencies,
        uploadPath,
        analysisId,
        request.query,
        request.log,
        request.id,
        reply,
      );
    },
  );
}
