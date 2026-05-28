-- CreateEnum
CREATE TYPE "AuthEventType" AS ENUM ('LOGIN_SUCCESS', 'LOGIN_FAILED', 'LOGOUT');

-- CreateTable
CREATE TABLE "auth_events" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT,
    "userId" TEXT,
    "email" TEXT,
    "eventType" "AuthEventType" NOT NULL,
    "provider" TEXT NOT NULL,
    "reason" TEXT,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "auth_events_tenantId_idx" ON "auth_events"("tenantId");

-- CreateIndex
CREATE INDEX "auth_events_userId_idx" ON "auth_events"("userId");

-- CreateIndex
CREATE INDEX "auth_events_createdAt_idx" ON "auth_events"("createdAt");

-- CreateIndex
CREATE INDEX "auth_events_email_idx" ON "auth_events"("email");

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_events" ADD CONSTRAINT "auth_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
