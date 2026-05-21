/**
 * Recertification / Cert Expiry Worker
 * Scans certification records, marks EXPIRING_SOON / EXPIRED,
 * and enqueues notification jobs for affected users.
 *
 * Designed to run on a cron schedule (daily at 06:00 UTC).
 */
import { Worker, Queue } from "bullmq";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { QUEUE_CERT_EXPIRY, QUEUE_NOTIFICATIONS } from "../src/lib/queues.js";
import type { NotificationJobData, CertExpiryScanJobData } from "../src/lib/queues.js";
import { certExpiringEmail, certExpiredEmail } from "../src/lib/email.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const parsed = new URL(redisUrl);
const connection = { host: parsed.hostname, port: parseInt(parsed.port || "6379", 10) };

const notifQueue = new Queue<NotificationJobData>(QUEUE_NOTIFICATIONS, { connection });

const worker = new Worker<CertExpiryScanJobData>(
  QUEUE_CERT_EXPIRY,
  async (job) => {
    const { tenantId } = job.data;
    const now = new Date();

    const certs = await prisma.certification.findMany({
      where: { ...(tenantId ? { tenantId } : {}), isActive: true },
      select: { id: true, name: true, tenantId: true, renewalWindowDays: true },
    });

    const certMap = new Map(certs.map((c) => [c.id, c]));

    const records = await prisma.certificationRecord.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { in: ["VALID", "EXPIRING_SOON"] },
        expiresAt: { not: null },
      },
      include: {
        user: { select: { id: true, name: true, email: true } },
        certification: { select: { name: true, renewalWindowDays: true } },
      },
    });

    let expiredCount = 0;
    let expiringSoonCount = 0;

    for (const r of records) {
      if (!r.expiresAt) continue;
      const cert = certMap.get(r.certificationId);
      const windowDays = cert?.renewalWindowDays ?? r.certification.renewalWindowDays;
      const windowMs = windowDays * 86400000;
      const isExpired = r.expiresAt <= now;
      const isExpiringSoon = !isExpired && r.expiresAt <= new Date(now.getTime() + windowMs);

      let newStatus: "EXPIRED" | "EXPIRING_SOON" | null = null;
      if (isExpired && r.status !== "EXPIRED") newStatus = "EXPIRED";
      else if (isExpiringSoon && r.status === "VALID") newStatus = "EXPIRING_SOON";

      if (newStatus) {
        await prisma.certificationRecord.update({ where: { id: r.id }, data: { status: newStatus } });
        await prisma.certificationHistory.create({
          data: { recordId: r.id, fromStatus: r.status, toStatus: newStatus, reason: "Automated expiry scan" },
        });

        const expiresOnStr = r.expiresAt.toLocaleDateString("en-US");
        const emailHtml = newStatus === "EXPIRED"
          ? certExpiredEmail(r.user.name ?? r.user.email, r.certification.name)
          : certExpiringEmail(r.user.name ?? r.user.email, r.certification.name, expiresOnStr, `${process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"}/compliance`);

        await notifQueue.add("cert-status", {
          tenantId: r.tenantId,
          userId: r.userId,
          type: newStatus === "EXPIRED" ? "CERT_EXPIRED" : "CERT_EXPIRING",
          title: newStatus === "EXPIRED"
            ? `Certification expired: ${r.certification.name}`
            : `Certification expiring soon: ${r.certification.name}`,
          body: newStatus === "EXPIRED"
            ? `Your ${r.certification.name} certification has expired.`
            : `Your ${r.certification.name} certification expires on ${expiresOnStr}.`,
          link: "/compliance",
          sendEmail: true,
          emailAddress: r.user.email,
          meta: { html: emailHtml },
        });

        if (newStatus === "EXPIRED") expiredCount++;
        else expiringSoonCount++;
      }
    }

    console.log(`[cert-expiry] expired=${expiredCount} expiringSoon=${expiringSoonCount}`);
  },
  { connection }
);

worker.on("completed", (job) => console.log(`[cert-expiry] job ${job.id} done`));
worker.on("failed", (job, err) => console.error(`[cert-expiry] job ${job?.id} failed:`, err.message));

console.log("Cert expiry worker started");
