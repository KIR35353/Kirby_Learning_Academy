/*
  Warnings:

  - A unique constraint covering the columns `[tenantId,externalId]` on the table `courses` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "courses" ADD COLUMN     "externalId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "courses_tenantId_externalId_key" ON "courses"("tenantId", "externalId");
