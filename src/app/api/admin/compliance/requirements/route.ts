import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

const reqSchema = z.object({
  certificationId: z.string(),
  scope: z.enum(["JOB_TITLE", "DEPARTMENT", "LOCATION", "BUSINESS_UNIT"]),
  scopeId: z.string().nullable().optional(),
});

// GET /api/admin/compliance/requirements
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const requirements = await db.complianceRequirement.findMany({
    where: { tenantId: session.user.tenantId, isActive: true },
    include: {
      certification: { select: { id: true, name: true, framework: true } },
    },
    orderBy: [{ certification: { name: "asc" } }, { scope: "asc" }],
  });
  return NextResponse.json(requirements);
}

// POST /api/admin/compliance/requirements
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = reqSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  // Verify cert belongs to tenant
  const cert = await db.certification.findFirst({
    where: { id: parsed.data.certificationId, tenantId: session.user.tenantId },
  });
  if (!cert) return NextResponse.json({ error: "Certification not found" }, { status: 404 });

  const req2 = await db.complianceRequirement.create({
    data: {
      tenantId: session.user.tenantId!,
      certificationId: parsed.data.certificationId,
      scope: parsed.data.scope,
      scopeId: parsed.data.scopeId ?? null,
    },
    include: { certification: { select: { id: true, name: true, framework: true } } },
  });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId!,
      action: "REQUIREMENT_CREATED",
      actorId: session.user.id,
      entityId: req2.id,
      entityType: "ComplianceRequirement",
      meta: { certName: cert.name, scope: parsed.data.scope, scopeId: parsed.data.scopeId },
    },
  });

  return NextResponse.json(req2, { status: 201 });
}

// DELETE /api/admin/compliance/requirements?id=xxx
export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  await db.complianceRequirement.updateMany({
    where: { id, tenantId: session.user.tenantId },
    data: { isActive: false },
  });
  return NextResponse.json({ ok: true });
}
