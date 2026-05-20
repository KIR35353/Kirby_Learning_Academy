import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const updateUserSchema = z.object({
  name: z.string().min(1).optional(),
  displayName: z.string().optional(),
  isActive: z.boolean().optional(),
  isContractor: z.boolean().optional(),
  departmentId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  jobTitleId: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  roleNames: z.array(z.string()).optional(),
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

  const { roleNames, hireDate, ...rest } = parsed.data;

  const updateData: Record<string, unknown> = {
    ...rest,
    ...(hireDate !== undefined && { hireDate: hireDate ? new Date(hireDate) : null }),
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

// DELETE /api/admin/users/[id] — deactivate (soft delete)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  // Prevent self-deactivation
  if (id === (session.user as Record<string, unknown>)?.id) {
    return NextResponse.json(
      { error: "Cannot deactivate your own account" },
      { status: 400 },
    );
  }

  await db.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ ok: true });
}
