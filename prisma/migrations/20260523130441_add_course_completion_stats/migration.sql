-- CreateTable
CREATE TABLE "course_completion_stats" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "totalSeconds" INTEGER,
    "sectionStats" JSONB,
    "questionStats" JSONB,
    "rawPayload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_completion_stats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "course_completion_stats_enrollmentId_key" ON "course_completion_stats"("enrollmentId");

-- CreateIndex
CREATE INDEX "course_completion_stats_courseId_idx" ON "course_completion_stats"("courseId");

-- CreateIndex
CREATE INDEX "course_completion_stats_userId_idx" ON "course_completion_stats"("userId");

-- AddForeignKey
ALTER TABLE "course_completion_stats" ADD CONSTRAINT "course_completion_stats_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
