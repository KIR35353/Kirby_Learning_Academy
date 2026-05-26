#!/bin/bash
set -e
cd /opt/kla

echo "=== npm install ==="
npm ci --prefer-offline 2>&1 | tail -5

echo "=== Prisma generate ==="
npx prisma generate 2>&1 | tail -3

echo "=== Wait for postgres to be ready ==="
for i in $(seq 1 20); do
  sudo docker exec kla_postgres pg_isready -U kla -d kla_dev > /dev/null 2>&1 && break
  echo "  waiting... ($i)"
  sleep 2
done

echo "=== Prisma migrate deploy ==="
npx prisma migrate deploy 2>&1

echo "=== Prisma seed ==="
npx prisma db seed 2>&1 | tail -10

echo "=== Init MinIO bucket ==="
node scripts/init-minio-bucket.mjs 2>&1

echo "=== Done ==="
