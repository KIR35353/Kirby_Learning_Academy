-- AlterTable
ALTER TABLE "course_versions" ADD COLUMN     "forceRetake" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "releaseDate" TIMESTAMP(3),
ADD COLUMN     "revisionNotes" TEXT;

-- CreateTable
CREATE TABLE "course_completion_history" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "courseVersionId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "score" DOUBLE PRECISION,
    "passed" BOOLEAN,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "snapshotAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "retakeVersionId" TEXT,

    CONSTRAINT "course_completion_history_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "course_completion_history_userId_idx" ON "course_completion_history"("userId");

-- CreateIndex
CREATE INDEX "course_completion_history_courseId_idx" ON "course_completion_history"("courseId");

-- CreateIndex
CREATE INDEX "course_completion_history_courseVersionId_idx" ON "course_completion_history"("courseVersionId");

-- CreateIndex
CREATE INDEX "course_completion_history_enrollmentId_idx" ON "course_completion_history"("enrollmentId");

-- AddForeignKey
ALTER TABLE "course_completion_history" ADD CONSTRAINT "course_completion_history_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completion_history" ADD CONSTRAINT "course_completion_history_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completion_history" ADD CONSTRAINT "course_completion_history_courseVersionId_fkey" FOREIGN KEY ("courseVersionId") REFERENCES "course_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completion_history" ADD CONSTRAINT "course_completion_history_retakeVersionId_fkey" FOREIGN KEY ("retakeVersionId") REFERENCES "course_versions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
