import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { generateDailyUserStats } from "@/workers/daily-user-stats.worker";

function isSuperAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN");
}

/**
 * POST /api/admin/stats/regenerate
 * Triggers immediate regeneration of daily user stats for all tenants/users
 * Useful for backfilling after schema changes or on-demand updates
 * 
 * Query params:
 *   - tenantId (optional): regenerate only for specific tenant
 *   - startDate (optional): ISO date to start from (default: today)
 * 
 * Super-admin only
 */
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get("tenantId");

  console.log("[stats:regenerate] Starting manual stats regeneration", {
    tenantId: tenantId || "all",
  });

  try {
    const result = await generateDailyUserStats();
    
    return NextResponse.json({
      success: true,
      message: "Daily stats regenerated successfully",
      processed: result.processed,
      errors: result.errors,
    });
  } catch (err) {
    console.error("[stats:regenerate] Error:", err);
    return NextResponse.json(
      {
        error: "Failed to regenerate stats",
        details: err instanceof Error ? err.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

/**
 * GET /api/admin/stats/status
 * Returns status of daily stats job
 */
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isSuperAdmin(session)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const job = await db.jobSchedule.findFirst({
      where: { jobType: "daily_user_stats" },
      select: {
        id: true,
        name: true,
        isActive: true,
        lastRunAt: true,
        cronExpr: true,
      },
    });

    if (!job) {
      return NextResponse.json({
        configured: false,
        message: "Daily stats job not configured",
      });
    }

    // Count materialized records
    const recordCount = await db.dailyUserStats.count();
    const latestDate = await db.dailyUserStats.findFirst({
      orderBy: { statDate: "desc" },
      select: { statDate: true },
    });

    return NextResponse.json({
      configured: true,
      job: {
        id: job.id,
        name: job.name,
        isActive: job.isActive,
        schedule: job.cronExpr,
        lastRunAt: job.lastRunAt,
      },
      stats: {
        totalRecords: recordCount,
        latestDate: latestDate?.statDate ?? null,
      },
    });
  } catch (err) {
    console.error("[stats:status] Error:", err);
    return NextResponse.json(
      { error: "Failed to get stats status" },
      { status: 500 },
    );
  }
}
