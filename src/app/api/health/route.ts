import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/health — liveness + readiness check for load balancers
export async function GET() {
  const start = Date.now();

  // Probe the database
  let dbOk = false;
  try {
    await db.$queryRaw`SELECT 1`;
    dbOk = true;
  } catch { /* db unreachable */ }

  const latency = Date.now() - start;
  const status = dbOk ? "healthy" : "degraded";

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version ?? "0.0.0",
      checks: {
        database: dbOk ? "ok" : "error",
        latencyMs: latency,
      },
    },
    { status: dbOk ? 200 : 503 }
  );
}
