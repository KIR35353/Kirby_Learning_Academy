import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { broadcastNotification } from "@/lib/notifications";
import { sendEmail, broadcastEmail } from "@/lib/email";

function isAdmin(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN"].includes(r));
}

const schema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),
  departmentId: z.string().optional(),
  sendEmail: z.boolean().default(false),
});

// POST /api/admin/notifications/broadcast
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const users = await db.user.findMany({
    where: {
      tenantId: session.user.tenantId,
      isActive: true,
      ...(parsed.data.departmentId ? { departmentId: parsed.data.departmentId } : {}),
    },
    select: { id: true, email: true, name: true },
  });

  const userIds = users.map((u) => u.id);
  const count = await broadcastNotification(
    session.user.tenantId!,
    userIds,
    "BROADCAST",
    parsed.data.title,
    parsed.data.body,
  );

  if (parsed.data.sendEmail) {
    const html = broadcastEmail(parsed.data.title, parsed.data.body);
    for (const user of users) {
      await sendEmail({ to: user.email, subject: parsed.data.title, html });
    }
  }

  return NextResponse.json({ sent: count, emailSent: parsed.data.sendEmail ? users.length : 0 }, { status: 201 });
}
