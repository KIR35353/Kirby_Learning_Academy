/**
 * upload-cbt-stats-patch.mjs
 * Uploads the analytics-patched CBT section HTML files + EXAM_Final.html
 * to MinIO for the Island Mode GTG course (KIR-GTG-001 / cmph9iqnb000070l4bdt7l8uz).
 *
 * Run: node scripts/upload-cbt-stats-patch.mjs
 */
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { readFileSync } from 'fs';
import path from 'path';

const MINIO_ENDPOINT = 'http://localhost:9000';
const BUCKET         = 'kirby-learning-academy-dev';
const COURSE_ID      = 'cmph9iqnb000070l4bdt7l8uz';
const LOCAL_DIR      = 'C:/S2L_Dev/CBT-Island-Mode-Systems';

const s3 = new S3Client({
  endpoint:         MINIO_ENDPOINT,
  region:           'us-east-1',
  forcePathStyle:   true,
  credentials: {
    accessKeyId:     'kla_minio',
    secretAccessKey: 'kla_minio_dev',
  },
});

const filesToUpload = [
  'S1_Section1.html',
  'S2_Section2.html',
  'S3_Section3.html',
  'S4_Section4.html',
  'S5_Section5.html',
  'S6_Section6.html',
  'EXAM_Final.html',
];

for (const filename of filesToUpload) {
  const localPath = path.join(LOCAL_DIR, filename);
  const key       = `courses/${COURSE_ID}/v1/${filename}`;

  const body = readFileSync(localPath);

  await s3.send(new PutObjectCommand({
    Bucket:      BUCKET,
    Key:         key,
    Body:        body,
    ContentType: 'text/html',
  }));

  console.log(`Uploaded: ${key}`);
}

console.log('\nAll files uploaded successfully.');
