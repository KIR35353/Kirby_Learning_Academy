import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

const updateSchema = z.object({
  status: z.enum(["VALID", "SUSPENDED", "EXPIRED", "PENDING"]).optional(),
  expiresAt: z.string().datetime().nullable().optional(),
  notes: z.string().optional(),
  reason: z.string().optional(),
  documentUrl: z.string().optional(),
});

// PATCH /api/admin/certifications/records/[recordId]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { recordId } = await params;
  const existing = await db.certificationRecord.findFirst({
    where: { id: recordId, tenantId: session.user.tenantId },
  });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.certificationRecord.update({
    where: { id: recordId },
    data: {
      status: parsed.data.status,
      expiresAt: parsed.data.expiresAt !== undefined
        ? (parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null)
        : undefined,
      notes: parsed.data.notes,
      documentUrl: parsed.data.documentUrl,
    },
  });

  // Write history if status changed
  if (parsed.data.status && parsed.data.status !== existing.status) {
    await db.certificationHistory.create({
      data: {
        recordId,
        fromStatus: existing.status,
        toStatus: parsed.data.status,
        changedById: session.user.id,
        reason: parsed.data.reason ?? null,
      },
    });

    const actionMap: Record<string, "CERT_REVOKED" | "CERT_SUSPENDED" | "CERT_EXPIRED"> = {
      SUSPENDED: "CERT_SUSPENDED",
      EXPIRED: "CERT_EXPIRED",
    };
    const action = actionMap[parsed.data.status] ?? "CERT_REVOKED";

    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId!,
        action,
        actorId: session.user.id,
        targetId: existing.userId,
        entityId: recordId,
        entityType: "CertificationRecord",
        meta: { fromStatus: existing.status, toStatus: parsed.data.status, reason: parsed.data.reason },
      },
    });
  }

  return NextResponse.json(updated);
}

// GET /api/admin/certifications/records/[recordId]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ recordId: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { recordId } = await params;
  const record = await db.certificationRecord.findFirst({
    where: { id: recordId, tenantId: session.user.tenantId },
    include: {
      certification: { select: { id: true, name: true, framework: true } },
      user: { select: { id: true, name: true, email: true } },
      issuedBy: { select: { id: true, name: true } },
      history: { orderBy: { changedAt: "desc" } },
    },
  });
  if (!record) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(record);
}
