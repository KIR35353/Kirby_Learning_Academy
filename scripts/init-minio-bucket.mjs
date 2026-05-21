// scripts/init-minio-bucket.mjs
// Run once after starting MinIO to create the dev bucket.
// Usage: node scripts/init-minio-bucket.mjs

import { S3Client, CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  endpoint: "http://localhost:9000",
  region: "us-east-1",
  forcePathStyle: true,
  credentials: {
    accessKeyId: "kla_minio",
    secretAccessKey: "kla_minio_dev",
  },
});

const BUCKET = "kirby-learning-academy-dev";

try {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  console.log(`Bucket already exists: ${BUCKET}`);
} catch (err) {
  const status = err.$metadata?.httpStatusCode;
  if (status === 404 || status === 301 || err.name === "NoSuchBucket" || err.name === "NotFound") {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket created: ${BUCKET}`);
  } else {
    console.error("Error:", err.message ?? err);
    process.exit(1);
  }
}
