/**
 * Overdue Escalation Worker
 * Scans enrollments past due date:
 *  - Notifies the learner (in-app + email)
 *  - Escalates to their manager after `escalateDays` (default 7)
 */
import { Worker, Queue } from "bullmq";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { QUEUE_OVERDUE_SCAN, QUEUE_NOTIFICATIONS } from "../src/lib/queues.js";
import type { NotificationJobData, OverdueScanJobData } from "../src/lib/queues.js";
import { courseOverdueEmail, managerEscalationEmail } from "../src/lib/email.js";

const prisma = new PrismaClient();
const redisUrl = process.env.REDIS_URL ?? "redis://localhost:6379";
const parsed = new URL(redisUrl);
const connection = { host: parsed.hostname, port: parseInt(parsed.port || "6379", 10) };

const notifQueue = new Queue<NotificationJobData>(QUEUE_NOTIFICATIONS, { connection });
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

const worker = new Worker<OverdueScanJobData>(
  QUEUE_OVERDUE_SCAN,
  async (job) => {
    const { tenantId, escalateDays = 7 } = job.data;
    const now = new Date();
    const escalateThreshold = new Date(now.getTime() - escalateDays * 86400000);

    const overdueEnrollments = await prisma.enrollment.findMany({
      where: {
        ...(tenantId ? { tenantId } : {}),
        status: { in: ["NOT_STARTED", "IN_PROGRESS"] },
        dueDate: { lt: now },
      },
      include: {
        user: { select: { id: true, name: true, email: true, tenantId: true } },
        course: { select: { id: true, title: true } },
      },
    });

    for (const e of overdueEnrollments) {
      const daysOverdue = Math.ceil((now.getTime() - e.dueDate!.getTime()) / 86400000);
      const courseLink = `${APP_URL}/courses/${e.courseId}/launch`;

      // Notify the learner
      await notifQueue.add("overdue-learner", {
        tenantId: e.tenantId,
        userId: e.userId,
        type: "COURSE_OVERDUE",
        title: `Overdue: ${e.course.title}`,
        body: `Your training "${e.course.title}" is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue.`,
        link: courseLink,
        sendEmail: true,
        emailAddress: e.user.email,
        meta: { html: courseOverdueEmail(e.user.name ?? e.user.email, e.course.title, daysOverdue, courseLink) },
      });

      // Escalate to manager if past threshold
      if (e.dueDate! < escalateThreshold) {
        const manager = await prisma.user.findFirst({
          where: {
            tenantId: e.tenantId,
            isActive: true,
            roles: { some: { role: { name: "MANAGER" } } },
            departmentId: e.user.tenantId, // imperfect; Phase 13 will scope by team
          },
          select: { id: true, name: true, email: true },
        });

        if (manager) {
          const managerLink = `${APP_URL}/manager/dashboard`;
          await notifQueue.add("overdue-manager-escalation", {
            tenantId: e.tenantId,
            userId: manager.id,
            type: "COURSE_OVERDUE",
            title: `Team member overdue: ${e.user.name ?? e.user.email}`,
            body: `${e.user.name ?? e.user.email} is ${daysOverdue} days overdue on "${e.course.title}".`,
            link: managerLink,
            sendEmail: true,
            emailAddress: manager.email,
            meta: {
              html: managerEscalationEmail(
                manager.name ?? manager.email,
                e.user.name ?? e.user.email,
                e.course.title,
                daysOverdue,
                managerLink
              ),
            },
          });
        }
      }
    }

    console.log(`[overdue-scan] processed ${overdueEnrollments.length} overdue enrollments`);
  },
  { connection }
);

worker.on("completed", (job) => console.log(`[overdue-scan] job ${job.id} done`));
worker.on("failed", (job, err) => console.error(`[overdue-scan] job ${job?.id} failed:`, err.message));

console.log("Overdue scan worker started");
