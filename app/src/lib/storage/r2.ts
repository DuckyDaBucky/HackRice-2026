import "server-only";
import { HeadObjectCommand, S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const UPLOAD_URL_TTL_SECONDS = 10 * 60;
const PLAYBACK_URL_TTL_SECONDS = 60 * 60;

function client() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  if (!accountId || !accessKeyId || !secretAccessKey) {
    throw new Error("R2 is not configured (R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY).");
  }
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

function bucket() {
  const name = process.env.R2_BUCKET;
  if (!name) throw new Error("R2 is not configured (R2_BUCKET).");
  return name;
}

/** One key per (session, question) — a retry overwrites the prior clip rather than orphaning it. */
export function answerClipKey(sessionId: string, questionId: string, mimeType: string) {
  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  return `interviews/${sessionId}/${questionId}.${ext}`;
}

/**
 * V2 keeps each physical recording addressable. Retries reuse an artifact id;
 * a revisit gets a new id and can never overwrite an earlier answer.
 */
export function artifactClipKey(sessionId: string, artifactId: string, mimeType: string) {
  const ext = mimeType.includes("webm") ? "webm" : "mp4";
  return `interviews/${sessionId}/artifacts/${artifactId}.${ext}`;
}

export async function createUploadUrl(key: string, contentType: string): Promise<string> {
  return getSignedUrl(
    client(),
    new PutObjectCommand({ Bucket: bucket(), Key: key, ContentType: contentType }),
    { expiresIn: UPLOAD_URL_TTL_SECONDS },
  );
}

export async function createPlaybackUrl(key: string): Promise<string> {
  return getSignedUrl(client(), new GetObjectCommand({ Bucket: bucket(), Key: key }), {
    expiresIn: PLAYBACK_URL_TTL_SECONDS,
  });
}

/** Verify the object exists after a direct browser PUT before recording it as uploaded. */
export async function getUploadedObjectMetadata(key: string): Promise<{
  byteSize: number | null;
  checksumSha256: string | null;
}> {
  const result = await client().send(new HeadObjectCommand({ Bucket: bucket(), Key: key }));
  return {
    byteSize: typeof result.ContentLength === "number" ? result.ContentLength : null,
    checksumSha256: result.ChecksumSHA256 ?? null,
  };
}

/** Reads a recorded clip fully into memory to relay it to a server-side analysis service. */
export async function getObjectBuffer(key: string): Promise<{ buffer: Buffer; contentType: string | null }> {
  const result = await client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Object body was empty for key ${key}.`);
  return { buffer: Buffer.from(bytes), contentType: result.ContentType ?? null };
}
