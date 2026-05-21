import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { NotificationType } from "@/generated/prisma";

const NOTIFICATION_TYPES = Object.values(NotificationType) as [string, ...string[]];

const updateSchema = z.object({
  preferences: z.array(z.object({
    type: z.enum(NOTIFICATION_TYPES),
    inApp: z.boolean(),
    email: z.boolean(),
  })),
});

// GET /api/notifications/preferences
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const prefs = await db.notificationPreference.findMany({
    where: { userId: session.user.id! },
  });

  // Fill defaults for types not yet in DB (default: all on)
  const result = NOTIFICATION_TYPES.map((type) => {
    const existing = prefs.find((p) => p.type === type);
    return existing ?? { type, inApp: true, email: true };
  });

  return NextResponse.json(result);
}

// PATCH /api/notifications/preferences
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  for (const pref of parsed.data.preferences) {
    await db.notificationPreference.upsert({
      where: { userId_type: { userId: session.user.id!, type: pref.type as NotificationType } },
      update: { inApp: pref.inApp, email: pref.email },
      create: { userId: session.user.id!, type: pref.type as NotificationType, inApp: pref.inApp, email: pref.email },
    });
  }

  return NextResponse.json({ ok: true });
}
