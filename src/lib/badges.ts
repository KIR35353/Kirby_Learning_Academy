import { db } from "@/lib/db";
import type { BadgeTrigger } from "@/generated/prisma";

/**
 * Award a badge to a user if one exists for the given trigger.
 * Returns the awarded UserBadge or null if no badge matched or already awarded.
 */
export async function awardBadge(params: {
  userId: string;
  tenantId: string;
  trigger: BadgeTrigger;
  triggerValue?: string;
}) {
  const { userId, tenantId, trigger, triggerValue } = params;

  const badge = await db.badge.findFirst({
    where: {
      tenantId,
      trigger,
      isActive: true,
      ...(triggerValue ? { triggerValue } : {}),
    },
  });

  if (!badge) return null;

  // Already awarded?
  const existing = await db.userBadge.findUnique({
    where: { userId_badgeId: { userId, badgeId: badge.id } },
  });
  if (existing) return null;

  return db.userBadge.create({
    data: { userId, badgeId: badge.id },
    include: { badge: true },
  });
}

/**
 * Award multiple badges for a single trigger if multiple badges share the same trigger.
 */
export async function awardBadgesForTrigger(params: {
  userId: string;
  tenantId: string;
  trigger: BadgeTrigger;
  triggerValue?: string;
}) {
  const { userId, tenantId, trigger, triggerValue } = params;

  const badges = await db.badge.findMany({
    where: {
      tenantId,
      trigger,
      isActive: true,
      ...(triggerValue ? { triggerValue } : {}),
    },
  });

  const results = [];
  for (const badge of badges) {
    const existing = await db.userBadge.findUnique({
      where: { userId_badgeId: { userId, badgeId: badge.id } },
    });
    if (!existing) {
      const awarded = await db.userBadge.create({
        data: { userId, badgeId: badge.id },
        include: { badge: true },
      });
      results.push(awarded);
    }
  }
  return results;
}
