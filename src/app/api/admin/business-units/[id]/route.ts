import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  code: z.string().max(20).nullable().optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

async function requireAdmin(unitId: string) {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 } as const;

  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return { error: "Forbidden", status: 403 } as const;
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;
  const unit = await db.businessUnit.findFirst({ where: { id: unitId, tenantId } });
  if (!unit) return { error: "Not found", status: 404 } as const;

  return { session, tenantId, unit } as const;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const check = await requireAdmin(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  const body = await request.json() as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Guard against circular parent references
  if (parsed.data.parentId === id) {
    return NextResponse.json({ error: "A business unit cannot be its own parent" }, { status: 400 });
  }

  const updated = await db.businessUnit.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const check = await requireAdmin(id);
  if ("error" in check) {
    return NextResponse.json({ error: check.error }, { status: check.status });
  }

  // Prevent deletion if users or departments are attached
  const counts = await db.businessUnit.findUnique({
    where: { id },
    include: { _count: { select: { users: true, departments: true, children: true } } },
  });

  if (
    counts &&
    (counts._count.users > 0 || counts._count.departments > 0 || counts._count.children > 0)
  ) {
    return NextResponse.json(
      { error: "Cannot delete a business unit that has users, departments, or child units" },
      { status: 409 },
    );
  }

  await db.businessUnit.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
