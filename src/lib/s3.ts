/**
 * S3 / MinIO client
 *
 * In local dev (S3_ENDPOINT set), points at MinIO running in Docker.
 * In production (S3_ENDPOINT unset), uses real AWS S3.
 *
 * MinIO local:
 *   S3_ENDPOINT=http://localhost:9000
 *   AWS_ACCESS_KEY_ID=kla_minio
 *   AWS_SECRET_ACCESS_KEY=kla_minio_dev
 *   S3_BUCKET_NAME=kirby-learning-academy-dev
 *   S3_REGION=us-east-1   (MinIO ignores this but the SDK requires it)
 *
 * Production AWS:
 *   Unset S3_ENDPOINT — the SDK uses the standard AWS endpoints.
 *   Set real AWS_ACCESS_KEY_ID / AWS_SECRET_ACCESS_KEY / S3_REGION / S3_BUCKET_NAME.
 */
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

const region = process.env.S3_REGION ?? process.env.AWS_REGION ?? "us-east-1";
const endpoint = process.env.S3_ENDPOINT; // set for MinIO; omit for real AWS
// Public-facing base URL for browser-accessible file links (thumbnails, launch
// URLs, etc.).  Defaults to S3_ENDPOINT when not set (fine for local dev).
// In production set this to the externally-routable MinIO/S3 URL, e.g.
//   S3_PUBLIC_URL=https://hanson01.eastus.cloudapp.azure.com
const publicEndpoint = process.env.S3_PUBLIC_URL ?? endpoint;

export const s3 = new S3Client({
  region,
  ...(endpoint
    ? {
        endpoint,
        forcePathStyle: true, // required for MinIO
        credentials: {
          accessKeyId: process.env.AWS_ACCESS_KEY_ID ?? "kla_minio",
          secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY ?? "kla_minio_dev",
        },
      }
    : {}),
});

export const S3_BUCKET = process.env.S3_BUCKET_NAME ?? "kirby-learning-academy-dev";

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Upload a Buffer or stream to S3/MinIO. Returns the object key. */
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
): Promise<string> {
  await s3.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
  return key;
}

/** Generate a short-lived presigned GET URL (default 1 hour). */
export async function getPresignedUrl(
  key: string,
  expiresInSeconds = 3600,
): Promise<string> {
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: expiresInSeconds },
  );
}

/** Delete an object. */
export async function deleteObject(key: string): Promise<void> {
  await s3.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}

/** Check if an object exists (returns false instead of throwing). */
export async function objectExists(key: string): Promise<boolean> {
  try {
    await s3.send(new HeadObjectCommand({ Bucket: S3_BUCKET, Key: key }));
    return true;
  } catch {
    return false;
  }
}

/** List all keys under a prefix. */
export async function listObjects(prefix: string): Promise<string[]> {
  const res = await s3.send(
    new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: prefix }),
  );
  return (res.Contents ?? []).map((o) => o.Key ?? "").filter(Boolean);
}

/**
 * Build the public base URL for a course bundle.
 * For MinIO: http://localhost:9000/bucket/prefix/
 * For AWS:   https://bucket.s3.region.amazonaws.com/prefix/
 */
export function getCourseBaseUrl(s3KeyPrefix: string): string {
  if (publicEndpoint) {
    return `${publicEndpoint}/${S3_BUCKET}/${s3KeyPrefix}`;
  }
  const region_ = region;
  return `https://${S3_BUCKET}.s3.${region_}.amazonaws.com/${s3KeyPrefix}`;
}

/**
 * Build the public URL for a single file key.
 * Used for branding assets (logos, favicons, banners) stored under tenants/.
 */
export function getPublicFileUrl(key: string): string {
  if (publicEndpoint) {
    return `${publicEndpoint}/${S3_BUCKET}/${key}`;
  }
  return `https://${S3_BUCKET}.s3.${region}.amazonaws.com/${key}`;
}
