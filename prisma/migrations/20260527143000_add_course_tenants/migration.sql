-- Create many-to-many course-to-tenant assignment table.
CREATE TABLE "course_tenants" (
  "id" TEXT NOT NULL,
  "courseId" TEXT NOT NULL,
  "tenantId" TEXT NOT NULL,
  "assignedById" TEXT,
  "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "course_tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "course_tenants_courseId_tenantId_key"
  ON "course_tenants"("courseId", "tenantId");

CREATE INDEX "course_tenants_tenantId_idx"
  ON "course_tenants"("tenantId");

CREATE INDEX "course_tenants_courseId_idx"
  ON "course_tenants"("courseId");

ALTER TABLE "course_tenants"
  ADD CONSTRAINT "course_tenants_courseId_fkey"
  FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_tenants"
  ADD CONSTRAINT "course_tenants_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "course_tenants"
  ADD CONSTRAINT "course_tenants_assignedById_fkey"
  FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill from existing single-tenant course ownership.
INSERT INTO "course_tenants" ("id", "courseId", "tenantId", "assignedById", "assignedAt")
SELECT
  concat('ct_', c."id", '_', c."tenantId"),
  c."id",
  c."tenantId",
  c."createdById",
  c."createdAt"
FROM "courses" c
ON CONFLICT ("courseId", "tenantId") DO NOTHING;
