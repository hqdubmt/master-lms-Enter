import type { Readable } from "stream";
import { minioClient, BUCKET } from "../lib/minio.js";

export async function ensureBucket(): Promise<void> {
  const exists = await minioClient.bucketExists(BUCKET);
  if (!exists) {
    await minioClient.makeBucket(BUCKET, process.env.MINIO_REGION ?? "us-east-1");

    // Set public read policy so HLS segments are publicly accessible
    const policy = JSON.stringify({
      Version: "2012-10-17",
      Statement: [
        {
          Effect: "Allow",
          Principal: { AWS: ["*"] },
          Action: ["s3:GetObject"],
          Resource: [`arn:aws:s3:::${BUCKET}/*`],
        },
      ],
    });

    await minioClient.setBucketPolicy(BUCKET, policy);
  }
}

export async function upload(
  key: string,
  stream: Readable,
  size: number,
  mimetype: string
): Promise<string> {
  await minioClient.putObject(BUCKET, key, stream, size, {
    "Content-Type": mimetype,
  });

  const endpoint = process.env.MINIO_ENDPOINT ?? "localhost";
  const port = process.env.MINIO_PORT ?? "9000";
  const protocol = process.env.MINIO_USE_SSL === "true" ? "https" : "http";

  return `${protocol}://${endpoint}:${port}/${BUCKET}/${key}`;
}

export async function deleteObject(key: string): Promise<void> {
  await minioClient.removeObject(BUCKET, key);
}

export async function presignedUrl(
  key: string,
  expiry = 3600
): Promise<string> {
  return minioClient.presignedGetObject(BUCKET, key, expiry);
}
