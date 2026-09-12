// One-time setup: allows the browser to PUT recorded clips directly to R2.
// Run after R2_* env vars are set in .env.local:
//   node --conditions=react-server --env-file=.env.local --import tsx scripts/configure-r2-cors.ts <allowed-origin> [more-origins...]
// e.g. ...configure-r2-cors.ts http://localhost:3000 https://your-deployed-domain.example
import { S3Client, PutBucketCorsCommand } from "@aws-sdk/client-s3";

async function main() {
  const origins = process.argv.slice(2);
  if (origins.length === 0) {
    throw new Error("usage: configure-r2-cors.ts <allowed-origin> [more-origins...]");
  }

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) {
    throw new Error("Missing R2_ACCOUNT_ID / R2_ACCESS_KEY_ID / R2_SECRET_ACCESS_KEY / R2_BUCKET.");
  }

  const s3 = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });

  await s3.send(
    new PutBucketCorsCommand({
      Bucket: bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: origins,
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );

  console.log(JSON.stringify({ bucket, origins, applied: true }));
}

main().catch((e) => {
  console.error(JSON.stringify({ applied: false, error: String(e) }));
  process.exitCode = 1;
});
