import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

// POST /api/admin/compliance/scan-expiry
// Scans all VALID records and updates status based on expiresAt.
// In Phase 11 this will be called by a BullMQ cron job; for now it's a manual trigger.
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const now = new Date();

  // Fetch all active certifications to get their renewalWindowDays
  const certMap = new Map(
    (await db.certification.findMany({ where: { tenantId: session.user.tenantId }, select: { id: true, renewalWindowDays: true } }))
      .map((c) => [c.id, c.renewalWindowDays])
  );

  // Find all VALID records with expiresAt set
  const records = await db.certificationRecord.findMany({
    where: {
      tenantId: session.user.tenantId,
      status: { in: ["VALID", "EXPIRING_SOON"] },
      expiresAt: { not: null },
    },
    select: { id: true, certificationId: true, status: true, expiresAt: true, userId: true },
  });

  let expiredCount = 0;
  let expiringSoonCount = 0;

  for (const r of records) {
    if (!r.expiresAt) continue;
    const windowDays = certMap.get(r.certificationId) ?? 90;
    const windowMs = windowDays * 86400000;
    const isExpired = r.expiresAt <= now;
    const isExpiringSoon = !isExpired && r.expiresAt <= new Date(now.getTime() + windowMs);

    let newStatus: "EXPIRED" | "EXPIRING_SOON" | null = null;
    if (isExpired && r.status !== "EXPIRED") newStatus = "EXPIRED";
    else if (isExpiringSoon && r.status === "VALID") newStatus = "EXPIRING_SOON";

    if (newStatus) {
      await db.certificationRecord.update({ where: { id: r.id }, data: { status: newStatus } });
      await db.certificationHistory.create({
        data: {
          recordId: r.id,
          fromStatus: r.status,
          toStatus: newStatus,
          reason: "Automated expiry scan",
        },
      });
      await db.auditLog.create({
        data: {
          tenantId: session.user.tenantId!,
          action: newStatus === "EXPIRED" ? "CERT_EXPIRED" : "CERT_ISSUED",
          targetId: r.userId,
          entityId: r.id,
          entityType: "CertificationRecord",
          meta: { automated: true, newStatus },
        },
      });

      if (newStatus === "EXPIRED") expiredCount++;
      else expiringSoonCount++;
    }
  }

  return NextResponse.json({ scanned: records.length, expired: expiredCount, expiringSoon: expiringSoonCount });
}
