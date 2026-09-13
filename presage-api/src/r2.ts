import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { createWriteStream } from "node:fs";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";

import type { AppConfig } from "./config.js";

export interface R2Download {
  stream: Readable;
  contentLength?: number | undefined;
}

export type R2Fetcher = (bucket: string, key: string) => Promise<R2Download>;

export class R2Error extends Error {
  code: string;
  retryable: boolean;

  constructor(code: string, message: string, retryable: boolean) {
    super(message);
    this.name = "R2Error";
    this.code = code;
    this.retryable = retryable;
  }
}

const MAX_KEY_LENGTH = 1024;

export function validateR2Key(raw: unknown, prefix: string): string {
  if (typeof raw !== "string" || raw.length === 0) {
    throw new R2Error("R2_KEY_INVALID", "A JSON body with an R2 object key is required", false);
  }
  if (raw.length > MAX_KEY_LENGTH) {
    throw new R2Error("R2_KEY_INVALID", "The R2 object key is too long", false);
  }
  if (raw.startsWith("/") || raw.includes("\\") || raw.split("/").includes("..")) {
    throw new R2Error("R2_KEY_INVALID", "The R2 object key is not allowed", false);
  }
  // eslint-disable-next-line no-control-regex
  if (/[\0-\x1F\x7F]/.test(raw)) {
    throw new R2Error("R2_KEY_INVALID", "The R2 object key is not allowed", false);
  }
  if (prefix && !raw.startsWith(prefix)) {
    throw new R2Error(
      "R2_KEY_INVALID",
      `The R2 object key must start with ${prefix}`,
      false,
    );
  }
  return raw;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === "string" ? code : undefined;
  }
  return undefined;
}

function mapClientError(error: unknown): R2Error {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name?: unknown }).name)
      : "";
  if (name === "NoSuchKey" || name === "NotFound") {
    return new R2Error("R2_KEY_NOT_FOUND", "The R2 object does not exist", false);
  }
  const message = error instanceof Error ? error.message : "Unknown R2 error";
  return new R2Error("R2_FETCH_FAILED", `Could not fetch the video from R2: ${message}`, true);
}

function toNodeReadable(body: unknown): Readable {
  if (body instanceof Readable) return body;
  if (
    typeof body === "object" &&
    body !== null &&
    Symbol.asyncIterator in (body as Record<PropertyKey, unknown>)
  ) {
    return Readable.from(body as AsyncIterable<Uint8Array>);
  }
  throw new R2Error("R2_FETCH_FAILED", "The R2 response had no readable body", true);
}

export function createR2Fetcher(config: AppConfig): R2Fetcher {
  const r2 = config.r2;
  if (!r2) {
    throw new R2Error("R2_NOT_CONFIGURED", "The service has no R2 bucket configured", false);
  }
  const client = new S3Client({
    region: "auto",
    endpoint: `https://${r2.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2.accessKeyId, secretAccessKey: r2.secretAccessKey },
  });
  return async (bucket: string, key: string): Promise<R2Download> => {
    let output;
    try {
      output = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
    } catch (error) {
      throw mapClientError(error);
    }
    return { stream: toNodeReadable(output.Body), contentLength: output.ContentLength };
  };
}

export async function downloadR2Object(
  fetcher: R2Fetcher,
  bucket: string,
  key: string,
  destPath: string,
  maxBytes: number,
): Promise<number> {
  let download: R2Download;
  try {
    download = await fetcher(bucket, key);
  } catch (error) {
    if (errorCode(error) === "R2_KEY_NOT_FOUND") throw error;
    throw mapClientError(error);
  }
  if (download.contentLength !== undefined && download.contentLength > maxBytes) {
    download.stream.destroy();
    throw new R2Error("VIDEO_TOO_LARGE", "The R2 object exceeds MAX_VIDEO_BYTES", false);
  }
  let seen = 0;
  const limiter = new Transform({
    transform(chunk, _encoding, callback) {
      seen += (chunk as Uint8Array).length;
      if (seen > maxBytes) {
        callback(new R2Error("VIDEO_TOO_LARGE", "The R2 object exceeds MAX_VIDEO_BYTES", false));
        return;
      }
      callback(null, chunk);
    },
  });
  try {
    await pipeline(download.stream, limiter, createWriteStream(destPath, { flags: "wx", mode: 0o600 }));
  } catch (error) {
    if (errorCode(error) === "VIDEO_TOO_LARGE") throw error;
    throw new R2Error(
      "R2_FETCH_FAILED",
      `Could not fetch the video from R2: ${error instanceof Error ? error.message : "unknown error"}`,
      true,
    );
  }
  return seen;
}
