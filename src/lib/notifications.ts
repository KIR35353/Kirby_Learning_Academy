import { db } from "@/lib/db";
import type { NotificationType } from "@/generated/prisma";

interface CreateNotificationInput {
  tenantId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  link?: string;
  meta?: Record<string, unknown>;
}

/**
 * Creates an in-app notification synchronously.
 * For bulk / background sending use the BullMQ notification worker.
 */
export async function createNotification(input: CreateNotificationInput) {
  // Check user preference — skip if opted out
  const pref = await db.notificationPreference.findUnique({
    where: { userId_type: { userId: input.userId, type: input.type } },
  });
  if (pref && !pref.inApp) return null;

  return db.notification.create({
    data: {
      tenantId: input.tenantId,
      userId: input.userId,
      type: input.type,
      title: input.title,
      body: input.body,
      link: input.link,
      meta: input.meta as object,
    },
  });
}

/**
 * Bulk-create notifications for multiple users (e.g. broadcast).
 * Skips users who have opted out of the notification type.
 */
export async function broadcastNotification(
  tenantId: string,
  userIds: string[],
  type: NotificationType,
  title: string,
  body: string,
  link?: string,
  meta?: Record<string, unknown>
) {
  // Fetch opted-out users for this type
  const optedOut = await db.notificationPreference.findMany({
    where: { userId: { in: userIds }, type, inApp: false },
    select: { userId: true },
  });
  const optedOutSet = new Set(optedOut.map((p) => p.userId));
  const eligible = userIds.filter((id) => !optedOutSet.has(id));

  if (eligible.length === 0) return 0;

  await db.notification.createMany({
    data: eligible.map((userId) => ({
      tenantId,
      userId,
      type,
      title,
      body,
      link: link ?? null,
      meta: (meta ?? null) as object,
    })),
  });

  return eligible.length;
}
