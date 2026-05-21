-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_courses" (
    "id" TEXT NOT NULL,
    "learningPathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "prerequisiteCourseId" TEXT,

    CONSTRAINT "learning_path_courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curricula" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "curricula_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_paths" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "learningPathId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "curriculum_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "curriculum_assignments" (
    "id" TEXT NOT NULL,
    "curriculumId" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "roleName" TEXT,
    "departmentId" TEXT,
    "userId" TEXT,
    "dueDate" TIMESTAMP(3),
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assignedById" TEXT,

    CONSTRAINT "curriculum_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "learning_paths_tenantId_idx" ON "learning_paths"("tenantId");

-- CreateIndex
CREATE INDEX "learning_path_courses_learningPathId_idx" ON "learning_path_courses"("learningPathId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_courses_learningPathId_courseId_key" ON "learning_path_courses"("learningPathId", "courseId");

-- CreateIndex
CREATE INDEX "curricula_tenantId_idx" ON "curricula"("tenantId");

-- CreateIndex
CREATE INDEX "curriculum_paths_curriculumId_idx" ON "curriculum_paths"("curriculumId");

-- CreateIndex
CREATE UNIQUE INDEX "curriculum_paths_curriculumId_learningPathId_key" ON "curriculum_paths"("curriculumId", "learningPathId");

-- CreateIndex
CREATE INDEX "curriculum_assignments_curriculumId_idx" ON "curriculum_assignments"("curriculumId");

-- CreateIndex
CREATE INDEX "curriculum_assignments_userId_idx" ON "curriculum_assignments"("userId");

-- CreateIndex
CREATE INDEX "curriculum_assignments_departmentId_idx" ON "curriculum_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "curriculum_assignments_tenantId_idx" ON "curriculum_assignments"("tenantId");

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_courses" ADD CONSTRAINT "learning_path_courses_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curricula" ADD CONSTRAINT "curricula_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "tenants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_paths" ADD CONSTRAINT "curriculum_paths_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_paths" ADD CONSTRAINT "curriculum_paths_learningPathId_fkey" FOREIGN KEY ("learningPathId") REFERENCES "learning_paths"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignments" ADD CONSTRAINT "curriculum_assignments_curriculumId_fkey" FOREIGN KEY ("curriculumId") REFERENCES "curricula"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignments" ADD CONSTRAINT "curriculum_assignments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignments" ADD CONSTRAINT "curriculum_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "curriculum_assignments" ADD CONSTRAINT "curriculum_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
