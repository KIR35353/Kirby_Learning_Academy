import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const schema = z.object({
  ids: z.array(z.string()).optional(), // if omitted → mark all read
});

// PATCH /api/notifications/mark-read
export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const now = new Date();
  await db.notification.updateMany({
    where: {
      userId: session.user.id!,
      isRead: false,
      ...(parsed.data.ids ? { id: { in: parsed.data.ids } } : {}),
    },
    data: { isRead: true, readAt: now },
  });

  return NextResponse.json({ ok: true });
}
