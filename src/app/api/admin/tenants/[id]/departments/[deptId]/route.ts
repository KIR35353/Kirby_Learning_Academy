import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string; deptId: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) return null;
  return session;
}

// DELETE /api/admin/tenants/[id]/departments/[deptId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, deptId } = await params;

  const dept = await db.department.findUnique({
    where: { id: deptId },
    include: { _count: { select: { users: true } } },
  });

  if (!dept) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (dept.tenantId !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (dept._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${dept._count.users} user(s) are assigned to this department` },
      { status: 409 },
    );
  }

  await db.department.delete({ where: { id: deptId } });
  return NextResponse.json({ ok: true });
}
