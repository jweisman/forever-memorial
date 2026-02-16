import { S3Client } from "@aws-sdk/client-s3";

const globalForS3 = globalThis as unknown as { s3: S3Client | undefined };

function createS3Client() {
  return new S3Client({
    region: process.env.S3_REGION || "us-east-1",
    endpoint: process.env.S3_ENDPOINT,
    forcePathStyle: true, // Required for MinIO
    credentials: {
      accessKeyId: process.env.S3_ACCESS_KEY!,
      secretAccessKey: process.env.S3_SECRET_KEY!,
    },
  });
}

export const s3 = globalForS3.s3 ?? createS3Client();
if (process.env.NODE_ENV !== "production") globalForS3.s3 = s3;

export const S3_BUCKET = process.env.S3_BUCKET || "forever-uploads";
