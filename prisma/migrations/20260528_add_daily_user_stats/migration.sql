-- CreateTable
CREATE TABLE "daily_user_stats" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "statDate" TIMESTAMP(3) NOT NULL,
    "successfulLogins" INTEGER NOT NULL DEFAULT 0,
    "failedLogins" INTEGER NOT NULL DEFAULT 0,
    "coursesCompleted" INTEGER NOT NULL DEFAULT 0,
    "coursesInProgress" INTEGER NOT NULL DEFAULT 0,
    "coursesFailed" INTEGER NOT NULL DEFAULT 0,
    "coursesOverdue" INTEGER NOT NULL DEFAULT 0,
    "courseCompletionRate" INTEGER NOT NULL DEFAULT 0,
    "assessmentsPassed" INTEGER NOT NULL DEFAULT 0,
    "assessmentsFailed" INTEGER NOT NULL DEFAULT 0,
    "assessmentPassRate" INTEGER NOT NULL DEFAULT 0,
    "assessmentAvgScore" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "daily_user_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "daily_user_stats_tenantId_userId_statDate_key" ON "daily_user_stats"("tenantId", "userId", "statDate");

-- CreateIndex
CREATE INDEX "daily_user_stats_tenantId_statDate_idx" ON "daily_user_stats"("tenantId", "statDate");

-- CreateIndex
CREATE INDEX "daily_user_stats_userId_idx" ON "daily_user_stats"("userId");

-- CreateIndex
CREATE INDEX "daily_user_stats_statDate_idx" ON "daily_user_stats"("statDate");

-- AddForeignKey
ALTER TABLE "daily_user_stats" ADD CONSTRAINT "daily_user_stats_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_user_stats" ADD CONSTRAINT "daily_user_stats_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

