import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().optional(),
  tenantId: z.string().optional(),
  isActive: z.boolean().optional(),
  isContractor: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  roleNames: z.array(z.string()).optional(),
  newPassword: z.string().min(8).optional(),
});

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) return null;
  return session;
}

// GET /api/admin/users/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const user = await db.user.findUnique({
    where: { id },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isActive: true,
      isContractor: true,
      hireDate: true,
      emailVerified: true,
      createdAt: true,
      updatedAt: true,
      department: { select: { id: true, name: true } },
      location: { select: { id: true, name: true } },
      jobTitle: { select: { id: true, name: true } },
      roles: { select: { role: { select: { id: true, name: true } } } },
    },
  });

  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  return NextResponse.json({ user });
}

// PATCH /api/admin/users/[id]
export async function PATCH(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const sessionRoles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { roleNames, hireDate, tenantId, jobTitle, newPassword, ...rest } = parsed.data;

  // Resolve freeform job title text → FK (upsert by name within tenant)
  let resolvedJobTitleId: string | null | undefined = undefined;
  if (jobTitle !== undefined) {
    if (jobTitle?.trim()) {
      const userTenant = await db.user.findUnique({ where: { id }, select: { tenantId: true } });
      const tid = (tenantId && sessionRoles.includes("SUPER_ADMIN") ? tenantId : userTenant?.tenantId) ?? "";
      const jt = await db.jobTitle.upsert({
        where: { tenantId_name: { tenantId: tid, name: jobTitle.trim() } },
        create: { tenantId: tid, name: jobTitle.trim() },
        update: {},
      });
      resolvedJobTitleId = jt.id;
    } else {
      resolvedJobTitleId = null;
    }
  }

  const updateData: Record<string, unknown> = {
    ...rest,
    ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
    ...(resolvedJobTitleId !== undefined && { jobTitleId: resolvedJobTitleId }),
    // Only SUPER_ADMIN may move a user to a different tenant
    ...(tenantId && sessionRoles.includes("SUPER_ADMIN") && { tenantId }),
    ...(newPassword && { passwordHash: await bcrypt.hash(newPassword, 12) }),
  };

  if (roleNames !== undefined) {
    const roleRecords = await db.role.findMany({
      where: { name: { in: roleNames } },
    });
    // Replace roles
    await db.userRole.deleteMany({ where: { userId: id } });
    await db.userRole.createMany({
      data: roleRecords.map((r: { id: string }) => ({ userId: id, roleId: r.id })),
    });
  }

  const user = await db.user.update({
    where: { id },
    data: updateData,
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isContractor: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({ user });
}

// DELETE /api/admin/users/[id]
//   ?permanent=true  → hard/permanent delete (SUPER_ADMIN only)
//   default          → soft delete / deactivate
export async function DELETE(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const sessionUser = session.user as Record<string, unknown>;

  // Prevent self-modification
  if (id === sessionUser?.id) {
    return NextResponse.json(
      { error: "Cannot modify your own account" },
      { status: 400 },
    );
  }

  const permanent = new URL(req.url).searchParams.get("permanent") === "true";

  if (!permanent) {
    // Soft delete (deactivate)
    await db.user.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ ok: true });
  }

  // ── Permanent / hard delete ────────────────────────────────────────────────
  const roles = (sessionUser?.roles as string[]) ?? [];
  if (!roles.includes("SUPER_ADMIN")) {
    return NextResponse.json(
      { error: "Only Super Admins can permanently delete users" },
      { status: 403 },
    );
  }

  // Block deletion if user is the non-nullable author of courses or assessments
  const [courseCount, versionCount, assessmentCount] = await Promise.all([
    db.course.count({ where: { createdById: id } }),
    db.courseVersion.count({ where: { uploadedById: id } }),
    db.standaloneAssessment.count({ where: { createdById: id } }),
  ]);

  if (courseCount > 0 || versionCount > 0 || assessmentCount > 0) {
    const parts: string[] = [];
    if (courseCount > 0) parts.push(`${courseCount} course${courseCount !== 1 ? "s" : ""}`);
    if (versionCount > 0) parts.push(`${versionCount} course version${versionCount !== 1 ? "s" : ""}`);
    if (assessmentCount > 0) parts.push(`${assessmentCount} assessment${assessmentCount !== 1 ? "s" : ""}`);
    return NextResponse.json(
      {
        error: `Cannot permanently delete: user created ${parts.join(", ")}. Reassign or delete that content first.`,
      },
      { status: 409 },
    );
  }

  // Cascade cleanup inside a transaction
  await db.$transaction([
    // 1. Nullify secondary "assigned/issued/awarded by" references
    db.enrollment.updateMany({ where: { assignedById: id }, data: { assignedById: null } }),
    db.curriculumAssignment.updateMany({ where: { assignedById: id }, data: { assignedById: null } }),
    db.assessmentAssignment.updateMany({ where: { assignedById: id }, data: { assignedById: null } }),
    db.certificationRecord.updateMany({ where: { issuedById: id }, data: { issuedById: null } }),
    db.userBadge.updateMany({ where: { awardedById: id }, data: { awardedById: null } }),
    db.auditLog.updateMany({ where: { actorId: id }, data: { actorId: null } }),

    // 2. Delete the user's own data (order matters for FK constraints)
    //    CourseCompletionStats → Enrollment (no cascade set, delete first)
    db.courseCompletionStats.deleteMany({ where: { userId: id } }),
    db.enrollment.deleteMany({ where: { userId: id } }),

    db.assessmentAttempt.deleteMany({ where: { userId: id } }),
    db.assessmentAssignment.deleteMany({ where: { userId: id } }),

    db.curriculumAssignment.deleteMany({ where: { userId: id } }),

    db.certificationRecord.deleteMany({ where: { userId: id } }),
    db.digitalCertificate.deleteMany({ where: { userId: id } }),

    db.notification.deleteMany({ where: { userId: id } }),
    db.notificationPreference.deleteMany({ where: { userId: id } }),

    db.userBadge.deleteMany({ where: { userId: id } }),
    db.userSkill.deleteMany({ where: { userId: id } }),

    db.forumPost.deleteMany({ where: { authorId: id } }),
    db.forumThread.deleteMany({ where: { authorId: id } }),

    db.courseRating.deleteMany({ where: { userId: id } }),
    db.leaderboardOptOut.deleteMany({ where: { userId: id } }),
    db.courseCompletionHistory.deleteMany({ where: { userId: id } }),

    // 3. Delete the user record (Session, Account, UserRole, PasswordResetToken have cascade)
    db.user.delete({ where: { id } }),
  ]);

  return NextResponse.json({ ok: true });
}
