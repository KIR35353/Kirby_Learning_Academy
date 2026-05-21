import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { z } from "zod";
import { getCertExpiryQueue, getOverdueQueue } from "@/lib/queues";

function isSuperAdmin(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN"].includes(r));
}

const schema = z.object({
  job: z.enum(["cert_expiry_scan", "overdue_scan"]),
  escalateDays: z.number().int().min(1).optional(),
});

// POST /api/admin/jobs/trigger — manually queue a background job
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const tenantId = session.user.tenantId!;

  if (parsed.data.job === "cert_expiry_scan") {
    const queue = getCertExpiryQueue();
    const job = await queue.add("manual-trigger", { tenantId });
    return NextResponse.json({ queued: true, jobId: job.id });
  }

  if (parsed.data.job === "overdue_scan") {
    const queue = getOverdueQueue();
    const job = await queue.add("manual-trigger", {
      tenantId,
      escalateDays: parsed.data.escalateDays ?? 7,
    });
    return NextResponse.json({ queued: true, jobId: job.id });
  }

  return NextResponse.json({ error: "Unknown job" }, { status: 400 });
}
