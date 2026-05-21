import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { BadgeTrigger } from "@/generated/prisma";

function isAdmin(session: Session | null): boolean {
  return (session?.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN"].includes(r));
}

const TRIGGERS = Object.values(BadgeTrigger) as [string, ...string[]];

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  trigger: z.enum(TRIGGERS),
  triggerValue: z.string().optional(),
  points: z.number().int().min(0).default(10),
});

// GET /api/admin/badges — list all badges for tenant
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const badges = await db.badge.findMany({
    where: { tenantId: session.user.tenantId! },
    include: { _count: { select: { userBadges: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(badges);
}

// POST /api/admin/badges — create a badge
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const badge = await db.badge.create({
    data: {
      ...parsed.data,
      tenantId: session.user.tenantId!,
      trigger: parsed.data.trigger as BadgeTrigger,
      imageUrl: parsed.data.imageUrl || null,
    },
  });

  return NextResponse.json(badge, { status: 201 });
}
