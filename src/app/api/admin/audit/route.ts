import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";

function canAccessAuditLog(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) =>
    ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r)
  );
}

// GET /api/admin/audit — SIEM-ready audit log export
// ?from=ISO&to=ISO&action=CERT_ISSUED&actorId=...&entityType=...&page=1&pageSize=50
export async function GET(req: NextRequest) {
  const limited = await rateLimit(req, "api");
  if (limited) return limited;

  const session = await auth();
  if (!session?.user || !canAccessAuditLog(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const action = searchParams.get("action") as string | null;
  const actorId = searchParams.get("actorId");
  const entityType = searchParams.get("entityType");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(200, parseInt(searchParams.get("pageSize") ?? "50"));

  const where = {
    tenantId: session.user.tenantId!,
    ...(from || to
      ? {
          createdAt: {
            ...(from ? { gte: new Date(from) } : {}),
            ...(to ? { lte: new Date(to) } : {}),
          },
        }
      : {}),
    ...(action ? { action: action as never } : {}),
    ...(actorId ? { actorId } : {}),
    ...(entityType ? { entityType } : {}),
  };

  const [logs, total] = await Promise.all([
    db.auditLog.findMany({
      where,
      include: {
        actor: { select: { id: true, email: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.auditLog.count({ where }),
  ]);

  // Accept header: return JSON or NDJSON for streaming SIEM ingestion
  const accept = req.headers.get("accept") ?? "";
  if (accept.includes("application/x-ndjson")) {
    const ndjson = logs.map((l) => JSON.stringify(l)).join("\n");
    return new NextResponse(ndjson, {
      headers: { "Content-Type": "application/x-ndjson" },
    });
  }

  return NextResponse.json({
    data: logs,
    meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) },
  });
}
