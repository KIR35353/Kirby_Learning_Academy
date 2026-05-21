import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/my-learning
// Returns curricula and standalone learning paths assigned to the current user,
// with per-path and per-curriculum progress computed from enrollments.
export async function GET() {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id: userId, tenantId, roles = [] } = session.user;

  // Collect curricula the user is assigned to:
  //   1. Directly assigned to this user
  //   2. Assigned to their department
  //   3. Assigned to any of their roles by name
  const assignments = await db.curriculumAssignment.findMany({
    where: {
      tenantId,
      OR: [
        { userId },
        { departmentId: await getUserDepartmentId(userId) },
        { roleName: { in: roles } },
      ],
    },
    include: {
      curriculum: {
        include: {
          paths: {
            orderBy: { order: "asc" },
            include: {
              learningPath: {
                include: {
                  courses: {
                    orderBy: { order: "asc" },
                    include: {
                      course: {
                        select: { id: true, title: true, category: true, duration: true, status: true },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });

  // Deduplicate curricula (user may be assigned via multiple vectors)
  const seenCurriculumIds = new Set<string>();
  const curricula = assignments
    .filter((a) => {
      if (seenCurriculumIds.has(a.curriculumId)) return false;
      seenCurriculumIds.add(a.curriculumId);
      return a.curriculum.isActive;
    })
    .map((a) => ({ ...a.curriculum, dueDate: a.dueDate }));

  // Collect all course IDs referenced in these curricula
  const allCourseIds = new Set<string>();
  for (const curriculum of curricula) {
    for (const cp of curriculum.paths) {
      for (const lpc of cp.learningPath.courses) {
        allCourseIds.add(lpc.courseId);
      }
    }
  }

  // Load user's enrollments for those courses in one query
  const enrollments = await db.enrollment.findMany({
    where: { userId, tenantId, courseId: { in: Array.from(allCourseIds) } },
    select: { courseId: true, id: true, status: true, score: true, passed: true },
  });
  const enrollmentMap = new Map(enrollments.map((e) => [e.courseId, e]));

  // Compute per-path and per-curriculum progress
  const result = curricula.map((curriculum) => {
    const paths = curriculum.paths.map((cp) => {
      const lp = cp.learningPath;
      const requiredCourses = lp.courses.filter((c) => c.isRequired);
      const passedRequired = requiredCourses.filter((c) => {
        const e = enrollmentMap.get(c.courseId);
        return e?.status === "PASSED" || e?.status === "COMPLETED";
      });

      const coursesWithStatus = lp.courses.map((lpc) => {
        const enrollment = enrollmentMap.get(lpc.courseId);
        // Check prerequisite
        const prereqMet = lpc.prerequisiteCourseId
          ? (() => {
              const prereqEnrollment = enrollmentMap.get(lpc.prerequisiteCourseId);
              return prereqEnrollment?.status === "PASSED" || prereqEnrollment?.status === "COMPLETED";
            })()
          : true;

        return {
          ...lpc,
          enrollment: enrollment ?? null,
          isUnlocked: prereqMet,
        };
      });

      return {
        id: lp.id,
        title: lp.title,
        description: lp.description,
        isActive: lp.isActive,
        courses: coursesWithStatus,
        progress: requiredCourses.length > 0 ? Math.round((passedRequired.length / requiredCourses.length) * 100) : 0,
        completedCount: passedRequired.length,
        totalRequired: requiredCourses.length,
        isComplete: requiredCourses.length > 0 && passedRequired.length === requiredCourses.length,
      };
    });

    const totalPaths = paths.length;
    const completedPaths = paths.filter((p) => p.isComplete).length;

    return {
      id: curriculum.id,
      title: curriculum.title,
      description: curriculum.description,
      isActive: curriculum.isActive,
      dueDate: curriculum.dueDate,
      paths,
      progress: totalPaths > 0 ? Math.round((completedPaths / totalPaths) * 100) : 0,
      completedPaths,
      totalPaths,
      isComplete: totalPaths > 0 && completedPaths === totalPaths,
    };
  });

  return NextResponse.json({ curricula: result });
}

async function getUserDepartmentId(userId: string): Promise<string | null> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { departmentId: true } });
  return user?.departmentId ?? null;
}
