import { Queue } from "bullmq";
import { redisConnection } from "@/lib/redis";

// ── Queue names ───────────────────────────────────────────────────────────────
export const QUEUE_NOTIFICATIONS = "notifications";
export const QUEUE_CERT_EXPIRY = "cert-expiry-scan";
export const QUEUE_OVERDUE_SCAN = "overdue-scan";

// ── Queues ────────────────────────────────────────────────────────────────────
// Queues are created lazily — safe to import from Next.js API routes.

let notificationQueue: Queue | null = null;
let certExpiryQueue: Queue | null = null;
let overdueQueue: Queue | null = null;

export function getNotificationQueue(): Queue {
  if (!notificationQueue) {
    notificationQueue = new Queue(QUEUE_NOTIFICATIONS, { connection: redisConnection });
  }
  return notificationQueue;
}

export function getCertExpiryQueue(): Queue {
  if (!certExpiryQueue) {
    certExpiryQueue = new Queue(QUEUE_CERT_EXPIRY, { connection: redisConnection });
  }
  return certExpiryQueue;
}

export function getOverdueQueue(): Queue {
  if (!overdueQueue) {
    overdueQueue = new Queue(QUEUE_OVERDUE_SCAN, { connection: redisConnection });
  }
  return overdueQueue;
}

// ── Job payload types ─────────────────────────────────────────────────────────

export interface NotificationJobData {
  tenantId: string;
  userId: string;
  type: string;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
  /** If true, also send email via Resend */
  sendEmail?: boolean;
  emailAddress?: string;
}

export interface CertExpiryScanJobData {
  tenantId?: string; // undefined = all tenants
}

export interface OverdueScanJobData {
  tenantId?: string;
  escalateDays?: number; // overdue by this many days → email manager
}
