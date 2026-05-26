import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string; locId: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) return null;
  return session;
}

// DELETE /api/admin/tenants/[id]/locations/[locId]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id, locId } = await params;

  const loc = await db.location.findUnique({
    where: { id: locId },
    include: { _count: { select: { users: true } } },
  });

  if (!loc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (loc.tenantId !== id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (loc._count.users > 0) {
    return NextResponse.json(
      { error: `Cannot delete: ${loc._count.users} user(s) are assigned to this location` },
      { status: 409 },
    );
  }

  await db.location.delete({ where: { id: locId } });
  return NextResponse.json({ ok: true });
}
