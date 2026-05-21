/**
 * HRIS Sync Scheduler
 *
 * Registers a repeating BullMQ job that triggers the nightly HRIS sync
 * for each configured tenant.
 *
 * Call this once at app startup (or from a dedicated process).
 * The schedule uses cron syntax — default: 02:00 UTC every day.
 *
 * Usage:
 *   import { scheduleHrisSync } from "@/lib/hris-scheduler";
 *   scheduleHrisSync();
 */
import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";
import type { HrisSyncJobData } from "@/workers/hris-sync-worker";

const HRIS_SYNC_CRON = process.env.HRIS_SYNC_CRON ?? "0 2 * * *"; // 02:00 UTC

// Lazy singleton — Queue is not created until first use so Next.js build-time
// static generation never tries to open a Redis connection.
let _hrisSyncQueue: Queue<HrisSyncJobData> | null = null;

function getHrisSyncQueue(): Queue<HrisSyncJobData> {
  if (!_hrisSyncQueue) {
    _hrisSyncQueue = new Queue<HrisSyncJobData>("hris-sync", {
      connection: redisConnection,
    });
  }
  return _hrisSyncQueue;
}

export async function scheduleHrisSync(
  tenants: Array<{ tenantId: string; source: "workday" | "successfactors" | "csv" }>,
): Promise<void> {
  const queue = getHrisSyncQueue();
  for (const { tenantId, source } of tenants) {
    const jobName = `nightly-hris-sync:${tenantId}`;

    await queue.upsertJobScheduler(jobName, { pattern: HRIS_SYNC_CRON }, {
      name: jobName,
      data: { tenantId, source },
      opts: {
        attempts: 3,
        backoff: { type: "exponential", delay: 10_000 },
      },
    });
  }

  console.log(`[hris-scheduler] Scheduled ${tenants.length} tenant sync(s) — cron: ${HRIS_SYNC_CRON}`);
}

export { getHrisSyncQueue as hrisSyncQueue };
