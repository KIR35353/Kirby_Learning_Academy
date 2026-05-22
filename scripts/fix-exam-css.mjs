// Patches EXAM_Final.html in S3 to fix pointer-events bug
// .q-screen { display: flex } overrides .screen { display: none }, so all
// question screens are display:flex with opacity:0 — invisible but intercept clicks.
// Fix: add pointer-events:none to .screen base, pointer-events:auto to .screen.active

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

const s3 = new S3Client({
  region: 'us-east-1',
  endpoint: 'http://localhost:9000',
  forcePathStyle: true,
  credentials: { accessKeyId: 'kla_minio', secretAccessKey: 'kla_minio_dev' },
});

const bucket = 'kirby-learning-academy-dev';
const key = 'courses/cmph9iqnb000070l4bdt7l8uz/v1/EXAM_Final.html';

console.log('Fetching', key);
const resp = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
let html = await resp.Body.transformToString('utf-8');

let patched = 0;

// Add pointer-events: none to .screen base class
const before1 = 'transition: opacity 0.3s ease; }';
const after1  = 'transition: opacity 0.3s ease; pointer-events: none; }';
if (html.includes(before1)) {
  html = html.replace(before1, after1);
  patched++;
  console.log('✓ Added pointer-events: none to .screen base');
} else {
  console.log('✗ Could not find .screen base rule — trying alternate pattern');
  // Try without trailing space variations
  const alt = html.match(/\.screen\s*\{[^}]+\}/);
  if (alt) console.log('Found:', alt[0].slice(0, 120));
}

// Add pointer-events: auto to .screen.active
const before2 = '.screen.active  { display: flex; }';
const after2  = '.screen.active  { display: flex; pointer-events: auto; }';
if (html.includes(before2)) {
  html = html.replace(before2, after2);
  patched++;
  console.log('✓ Added pointer-events: auto to .screen.active');
} else {
  // Try with single space
  const b2alt = '.screen.active { display: flex; }';
  const a2alt = '.screen.active { display: flex; pointer-events: auto; }';
  if (html.includes(b2alt)) {
    html = html.replace(b2alt, a2alt);
    patched++;
    console.log('✓ Added pointer-events: auto to .screen.active (single space)');
  } else {
    console.log('✗ Could not find .screen.active rule');
  }
}

if (patched < 2) {
  console.error('Patching incomplete, aborting upload');
  process.exit(1);
}

console.log('Uploading patched file...');
await s3.send(new PutObjectCommand({
  Bucket: bucket,
  Key: key,
  Body: html,
  ContentType: 'text/html',
  ACL: 'public-read',
}));

console.log('Done! EXAM_Final.html patched and uploaded.');
