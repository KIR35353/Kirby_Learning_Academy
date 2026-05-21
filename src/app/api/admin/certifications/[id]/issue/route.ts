import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

const issueSchema = z.object({
  userIds: z.array(z.string()).min(1),
  issuedAt: z.string().datetime().optional(),
  notes: z.string().optional(),
  source: z.enum(["manual", "upload"]).default("manual"),
  documentUrl: z.string().url().optional(),
});

// POST /api/admin/certifications/[id]/issue — manually issue cert to one or more users
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id: certificationId } = await params;
  const cert = await db.certification.findFirst({ where: { id: certificationId, tenantId: session.user.tenantId } });
  if (!cert) return NextResponse.json({ error: "Certification not found" }, { status: 404 });

  const body = await req.json();
  const parsed = issueSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const issuedAt = parsed.data.issuedAt ? new Date(parsed.data.issuedAt) : new Date();
  const expiresAt = cert.validityDays
    ? new Date(issuedAt.getTime() + cert.validityDays * 86400000)
    : null;

  const records = [];
  for (const userId of parsed.data.userIds) {
    // Check user belongs to same tenant
    const user = await db.user.findFirst({ where: { id: userId, tenantId: session.user.tenantId } });
    if (!user) continue;

    // Find existing record for this cert+user
    const existing = await db.certificationRecord.findFirst({
      where: { certificationId, userId },
      orderBy: { createdAt: "desc" },
    });

    const record = await db.certificationRecord.create({
      data: {
        certificationId,
        userId,
        tenantId: session.user.tenantId!,
        status: "VALID",
        issuedAt,
        expiresAt,
        source: parsed.data.source,
        notes: parsed.data.notes ?? null,
        documentUrl: parsed.data.documentUrl ?? null,
        issuedById: session.user.id,
        renewedFromId: existing?.id ?? null,
      },
    });

    // History entry
    await db.certificationHistory.create({
      data: {
        recordId: record.id,
        fromStatus: existing?.status ?? null,
        toStatus: "VALID",
        changedById: session.user.id,
        reason: "Manually issued",
      },
    });

    // Audit log
    await db.auditLog.create({
      data: {
        tenantId: session.user.tenantId!,
        action: "CERT_ISSUED",
        actorId: session.user.id,
        targetId: userId,
        entityId: record.id,
        entityType: "CertificationRecord",
        meta: { certName: cert.name },
      },
    });

    records.push(record);
  }

  return NextResponse.json({ issued: records.length, records }, { status: 201 });
}
