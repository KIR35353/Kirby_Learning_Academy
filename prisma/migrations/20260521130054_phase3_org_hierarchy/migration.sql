-- AlterTable
ALTER TABLE "departments" ADD COLUMN     "businessUnitId" TEXT,
ADD COLUMN     "hrisId" TEXT,
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "businessUnitId" TEXT,
ADD COLUMN     "hrisId" TEXT,
ADD COLUMN     "hrisSource" TEXT,
ADD COLUMN     "lastHrisSyncAt" TIMESTAMP(3),
ADD COLUMN     "terminatedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "tenantId" TEXT NOT NULL,
    "parentId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "hrisId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hris_sync_logs" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "recordsIn" INTEGER NOT NULL DEFAULT 0,
    "created" INTEGER NOT NULL DEFAULT 0,
    "updated" INTEGER NOT NULL DEFAULT 0,
    "deactivated" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "hris_sync_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "business_units_tenantId_idx" ON "business_units"("tenantId");

-- CreateIndex
CREATE INDEX "business_units_parentId_idx" ON "business_units"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_tenantId_name_key" ON "business_units"("tenantId", "name");

-- CreateIndex
CREATE INDEX "hris_sync_logs_tenantId_idx" ON "hris_sync_logs"("tenantId");

-- CreateIndex
CREATE INDEX "hris_sync_logs_startedAt_idx" ON "hris_sync_logs"("startedAt");

-- CreateIndex
CREATE INDEX "departments_businessUnitId_idx" ON "departments"("businessUnitId");

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "business_units" ADD CONSTRAINT "business_units_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hris_sync_logs" ADD CONSTRAINT "hris_sync_logs_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
