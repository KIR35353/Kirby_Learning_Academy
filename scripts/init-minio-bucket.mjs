// scripts/init-minio-bucket.mjs
// Run once after starting MinIO to create the dev bucket and set the
// public-read policy on the courses/ prefix (needed for CBT iframe loading).

import { S3Client, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from "@aws-sdk/client-s3";

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

// ── Create bucket ─────────────────────────────────────────────────────────────
try {
  await s3.send(new HeadBucketCommand({ Bucket: BUCKET }));
  console.log(`Bucket already exists: ${BUCKET}`);
} catch (err) {
  const status = err.$metadata?.httpStatusCode;
  if (status === 404 || status === 301 || err.name === "NoSuchBucket" || err.name === "NotFound") {
    await s3.send(new CreateBucketCommand({ Bucket: BUCKET }));
    console.log(`Bucket created: ${BUCKET}`);
  } else {
    console.error("Error creating bucket:", err.message ?? err);
    process.exit(1);
  }
}

// ── Set public-read policy for courses/ prefix ────────────────────────────────
// Allows the browser to load CBT assets directly from MinIO in an iframe.
const policy = {
  Version: "2012-10-17",
  Statement: [
    {
      Sid: "PublicReadCourses",
      Effect: "Allow",
      Principal: { AWS: ["*"] },
      Action: ["s3:GetObject"],
      Resource: [`arn:aws:s3:::${BUCKET}/courses/*`],
    },
  ],
};

await s3.send(
  new PutBucketPolicyCommand({ Bucket: BUCKET, Policy: JSON.stringify(policy) }),
);
console.log(`Public-read policy applied to ${BUCKET}/courses/*`);

