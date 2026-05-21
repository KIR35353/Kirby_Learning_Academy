import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { hrisSyncQueue } from "@/lib/hris-scheduler";
import { z } from "zod";

const schema = z.object({
  source: z.enum(["workday", "successfactors", "csv"]),
  csvContent: z.string().optional(),
});

/** POST /api/admin/hris/sync — trigger an immediate HRIS sync job */
export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;

  const body = await request.json() as unknown;
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.source === "csv" && !parsed.data.csvContent) {
    return NextResponse.json({ error: "csvContent is required for CSV source" }, { status: 400 });
  }

  const job = await hrisSyncQueue().add(
    "manual-hris-sync",
    { tenantId, source: parsed.data.source, csvContent: parsed.data.csvContent },
    { attempts: 2, backoff: { type: "fixed", delay: 5000 } },
  );

  return NextResponse.json({ jobId: job.id, status: "queued" }, { status: 202 });
}

/** GET /api/admin/hris/sync — list recent sync logs */
export async function GET(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;
  const { searchParams } = new URL(request.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10), 100);

  const logs = await db.hrisSyncLog.findMany({
    where: { tenantId },
    orderBy: { startedAt: "desc" },
    take: limit,
  });

  return NextResponse.json(logs);
}
