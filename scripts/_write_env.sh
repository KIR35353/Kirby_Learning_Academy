#!/bin/bash
# Write the production .env for KLA on Azure
cat > /opt/kla/.env << 'ENVEOF'
# ── Database ─────────────────────────────────────────────────────────────────
DATABASE_URL="postgresql://kla:kla_dev_password@localhost:5432/kla_dev?schema=public"

# ── Redis ─────────────────────────────────────────────────────────────────────
REDIS_URL="redis://localhost:6379"

# ── Auth (NextAuth.js) ────────────────────────────────────────────────────────
AUTH_SECRET="qAwLDEeuLzGl6hBMaAKEZHQIXVm/kmv/XmqRcaXTflk="
NEXTAUTH_URL="https://hanson01.eastus.cloudapp.azure.com"
AUTH_MODE="credentials"

# ── S3 / MinIO ────────────────────────────────────────────────────────────────
S3_ENDPOINT="http://localhost:9000"
S3_REGION="us-east-1"
AWS_ACCESS_KEY_ID="kla_minio"
AWS_SECRET_ACCESS_KEY="kla_minio_dev"
S3_BUCKET_NAME="kirby-learning-academy-dev"
# Public URL — nginx will proxy /kirby-learning-academy-dev/ → MinIO
S3_PUBLIC_URL="https://hanson01.eastus.cloudapp.azure.com"

# ── Meilisearch ───────────────────────────────────────────────────────────────
MEILI_HOST="http://localhost:7700"
MEILI_MASTER_KEY="kla_meili_dev_key"

# ── Email ─────────────────────────────────────────────────────────────────────
RESEND_API_KEY="REPLACE_WITH_KEY"
EMAIL_FROM="noreply@kirbylearningacademy.com"
ENVEOF
echo ".env written"
