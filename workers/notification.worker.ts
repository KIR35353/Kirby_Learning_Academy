/**
 * Notification Worker
 * Run: node --experimental-specifier-resolution=node workers/notification.worker.js
 * Or via ts-node: npx ts-node workers/notification.worker.ts
 *
 * Processes jobs from the "notifications" queue.
 * Each job creates an in-app notification and optionally sends an email.
 */
import { Worker } from "bullmq";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import { Resend } from "resend";
import type { NotificationJobData } from "../src/lib/queues.js";
import { QUEUE_NOTIFICATIONS } from "../src/lib/queues.js";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);
const resend = new Resend(process.env.RESEND_API_KEY ?? "re_test_key");
const FROM = process.env.EMAIL_FROM ?? "Kirby Learning Academy <noreply@kirbyacademy.com>";

const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const parsed = new URL(redisUrl);
const connection = {
  host: parsed.hostname,
  port: parseInt(parsed.port || "6379", 10),
};

const worker = new Worker<NotificationJobData>(
  QUEUE_NOTIFICATIONS,
  async (job) => {
    const { tenantId, userId, type, title, body, link, meta, sendEmail, emailAddress } = job.data;

    // Check user preference
    const pref = await prisma.notificationPreference.findUnique({
      where: { userId_type: { userId, type: type as never } },
    });

    // Create in-app notification unless opted out
    if (!pref || pref.inApp) {
      await prisma.notification.create({
        data: { tenantId, userId, type: type as Parameters<typeof prisma.notification.create>[0]["data"]["type"], title, body, link, meta: meta as object },
      });
    }

    // Send email if requested and user has not opted out
    if (sendEmail && emailAddress && (!pref || pref.email)) {
      if (process.env.RESEND_API_KEY && process.env.RESEND_API_KEY !== "re_test_key") {
        await resend.emails.send({ from: FROM, to: emailAddress, subject: title, html: body });
      } else {
        console.log(`[email:dev] to=${emailAddress} subject="${title}"`);
      }
    }
  },
  { connection, concurrency: 10 }
);

worker.on("completed", (job) => console.log(`[notification] job ${job.id} done`));
worker.on("failed", (job, err) => console.error(`[notification] job ${job?.id} failed:`, err.message));

console.log("Notification worker started, listening on queue:", QUEUE_NOTIFICATIONS);
