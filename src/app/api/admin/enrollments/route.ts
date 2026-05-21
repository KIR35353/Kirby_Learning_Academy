import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const assignSchema = z.object({
  courseId: z.string(),
  userIds: z.array(z.string()).min(1).max(200),
  dueDate: z.string().datetime().optional(),
});

// GET /api/admin/enrollments — list all enrollments for the tenant
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canView =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("MANAGER") ||
    roles.includes("COMPLIANCE_OFFICER");
  if (!canView) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const courseId = searchParams.get("courseId");
  const userId = searchParams.get("userId");
  const status = searchParams.get("status");

  const enrollments = await db.enrollment.findMany({
    where: {
      tenantId: session.user.tenantId,
      ...(courseId ? { courseId } : {}),
      ...(userId ? { userId } : {}),
      ...(status ? { status: status as never } : {}),
    },
    include: {
      user: { select: { id: true, name: true, email: true, avatarUrl: true } },
      course: { select: { id: true, title: true, category: true } },
      assignedBy: { select: { name: true, email: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  return NextResponse.json(enrollments);
}

// POST /api/admin/enrollments — assign a course to one or more users
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const canAssign =
    roles.includes("SUPER_ADMIN") ||
    roles.includes("TENANT_ADMIN") ||
    roles.includes("MANAGER");
  if (!canAssign) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { courseId, userIds, dueDate } = parsed.data;

  const course = await db.course.findFirst({
    where: { id: courseId, tenantId: session.user.tenantId },
    include: { activeVersion: { select: { id: true } } },
  });
  if (!course) return NextResponse.json({ error: "Course not found" }, { status: 404 });

  // Upsert enrollments (skip existing ones to avoid overwriting progress)
  const results = await Promise.allSettled(
    userIds.map((userId) =>
      db.enrollment.upsert({
        where: { userId_courseId: { userId, courseId } },
        update: {
          dueDate: dueDate ? new Date(dueDate) : undefined,
        },
        create: {
          userId,
          courseId,
          courseVersionId: course.activeVersion?.id ?? null,
          tenantId: session.user.tenantId,
          assignedById: session.user.id,
          selfEnrolled: false,
          dueDate: dueDate ? new Date(dueDate) : null,
        },
      }),
    ),
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  return NextResponse.json({ assigned: succeeded, skipped: failed }, { status: 201 });
}
