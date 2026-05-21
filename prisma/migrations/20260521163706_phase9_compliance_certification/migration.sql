-- CreateEnum
CREATE TYPE "CertFramework" AS ENUM ('OSHA', 'USCG', 'EPA', 'ISM_CODE', 'STCW', 'DOT', 'INTERNAL');

-- CreateEnum
CREATE TYPE "CertStatus" AS ENUM ('PENDING', 'VALID', 'EXPIRING_SOON', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "CertType" AS ENUM ('INITIAL', 'RENEWAL', 'RECERTIFICATION');

-- CreateEnum
CREATE TYPE "RequirementScope" AS ENUM ('JOB_TITLE', 'DEPARTMENT', 'LOCATION', 'BUSINESS_UNIT');

-- CreateEnum
CREATE TYPE "AuditAction" AS ENUM ('CERT_ISSUED', 'CERT_RENEWED', 'CERT_EXPIRED', 'CERT_SUSPENDED', 'CERT_UPLOADED', 'CERT_REVOKED', 'REQUIREMENT_CREATED', 'REQUIREMENT_UPDATED', 'REQUIREMENT_DELETED');

-- CreateTable
CREATE TABLE "certifications" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "framework" "CertFramework" NOT NULL DEFAULT 'INTERNAL',
    "type" "CertType" NOT NULL DEFAULT 'INITIAL',
    "validityDays" INTEGER,
    "renewalWindowDays" INTEGER NOT NULL DEFAULT 90,
    "renewalCourseId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification_records" (
    "id" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "status" "CertStatus" NOT NULL DEFAULT 'PENDING',
    "issuedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "renewedFromId" TEXT,
    "source" TEXT NOT NULL,
    "sourceId" TEXT,
    "documentUrl" TEXT,
    "notes" TEXT,
    "issuedById" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certification_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certification_history" (
    "id" TEXT NOT NULL,
    "recordId" TEXT NOT NULL,
    "fromStatus" "CertStatus",
    "toStatus" "CertStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changedById" TEXT,
    "reason" TEXT,
    "ipAddress" TEXT,

    CONSTRAINT "certification_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "compliance_requirements" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "certificationId" TEXT NOT NULL,
    "scope" "RequirementScope" NOT NULL,
    "scopeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "compliance_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "action" "AuditAction" NOT NULL,
    "actorId" TEXT,
    "targetId" TEXT,
    "entityId" TEXT,
    "entityType" TEXT,
    "meta" JSONB,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "certifications_tenantId_idx" ON "certifications"("tenantId");

-- CreateIndex
CREATE UNIQUE INDEX "certifications_tenantId_name_key" ON "certifications"("tenantId", "name");

-- CreateIndex
CREATE INDEX "certification_records_certificationId_idx" ON "certification_records"("certificationId");

-- CreateIndex
CREATE INDEX "certification_records_userId_idx" ON "certification_records"("userId");

-- CreateIndex
CREATE INDEX "certification_records_tenantId_idx" ON "certification_records"("tenantId");

-- CreateIndex
CREATE INDEX "certification_records_status_idx" ON "certification_records"("status");

-- CreateIndex
CREATE INDEX "certification_records_expiresAt_idx" ON "certification_records"("expiresAt");

-- CreateIndex
CREATE INDEX "certification_history_recordId_idx" ON "certification_history"("recordId");

-- CreateIndex
CREATE INDEX "compliance_requirements_tenantId_idx" ON "compliance_requirements"("tenantId");

-- CreateIndex
CREATE INDEX "compliance_requirements_certificationId_idx" ON "compliance_requirements"("certificationId");

-- CreateIndex
CREATE INDEX "audit_logs_tenantId_idx" ON "audit_logs"("tenantId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_idx" ON "audit_logs"("actorId");

-- CreateIndex
CREATE INDEX "audit_logs_targetId_idx" ON "audit_logs"("targetId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_renewalCourseId_fkey" FOREIGN KEY ("renewalCourseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "certifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_records" ADD CONSTRAINT "certification_records_renewedFromId_fkey" FOREIGN KEY ("renewedFromId") REFERENCES "certification_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certification_history" ADD CONSTRAINT "certification_history_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "certification_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "compliance_requirements" ADD CONSTRAINT "compliance_requirements_certificationId_fkey" FOREIGN KEY ("certificationId") REFERENCES "certifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
