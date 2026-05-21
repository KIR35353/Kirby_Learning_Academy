/**
 * BullMQ Worker — HRIS Sync Job
 *
 * Processes jobs from the "hris-sync" queue.
 * Each job carries: { tenantId, source, config? }
 *
 * Scheduled nightly via the scheduler (see hris-scheduler.ts).
 * Can also be triggered on-demand via the Admin UI (/api/admin/hris/sync).
 *
 * Run this worker as a standalone Node process alongside the Next.js app:
 *   node --import tsx/esm src/workers/hris-sync-worker.ts
 */
import { Worker } from "bullmq";
import { redisConnection } from "@/lib/redis";
import { runHrisSync } from "@/lib/hris/sync-engine";
import { WorkdayAdapter } from "@/lib/hris/workday-adapter";
import { SuccessFactorsAdapter } from "@/lib/hris/successfactors-adapter";
import { db } from "@/lib/db";
import type { HrisAdapter } from "@/lib/hris/types";

export interface HrisSyncJobData {
  tenantId: string;
  source: "workday" | "successfactors" | "csv";
  csvContent?: string; // for on-demand CSV uploads
}

const worker = new Worker<HrisSyncJobData>(
  "hris-sync",
  async (job) => {
    const { tenantId, source, csvContent } = job.data;

    // Create a "running" log entry
    const syncLog = await db.hrisSyncLog.create({
      data: { tenantId, source, status: "running" },
    });

    let adapter: HrisAdapter;
    try {
      if (source === "workday") {
        adapter = new WorkdayAdapter();
      } else if (source === "successfactors") {
        adapter = new SuccessFactorsAdapter();
      } else {
        // CSV — content must be provided in the job payload
        if (!csvContent) throw new Error("CSV sync requires csvContent in job data");
        const { CsvAdapter } = await import("@/lib/hris/csv-adapter");
        adapter = new CsvAdapter(csvContent);
      }

      const hrisUsers = await adapter.fetchAll();
      const result = await runHrisSync(tenantId, source, hrisUsers);

      await db.hrisSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: result.errors.length > 0 ? "failed" : "success",
          recordsIn: result.recordsIn,
          created: result.created,
          updated: result.updated,
          deactivated: result.deactivated,
          errors: result.errors.length > 0 ? result.errors : undefined,
          finishedAt: new Date(),
        },
      });

      return result;
    } catch (err) {
      await db.hrisSyncLog.update({
        where: { id: syncLog.id },
        data: {
          status: "failed",
          errors: [err instanceof Error ? err.message : String(err)],
          finishedAt: new Date(),
        },
      });
      throw err;
    }
  },
  { connection: redisConnection, concurrency: 1 },
);

worker.on("completed", (job, result) => {
  console.log(
    `[hris-sync] Job ${job.id} completed — ` +
      `in:${result.recordsIn} created:${result.created} updated:${result.updated} ` +
      `deactivated:${result.deactivated} errors:${result.errors.length}`,
  );
});

worker.on("failed", (job, err) => {
  console.error(`[hris-sync] Job ${job?.id} failed:`, err);
});

export default worker;
