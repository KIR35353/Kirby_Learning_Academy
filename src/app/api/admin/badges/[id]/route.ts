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

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
  trigger: z.enum(TRIGGERS).optional(),
  triggerValue: z.string().optional(),
  points: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
});

// PATCH /api/admin/badges/[id]
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const badge = await db.badge.findUnique({ where: { id } });
  if (!badge || badge.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const updated = await db.badge.update({
    where: { id },
    data: {
      ...parsed.data,
      trigger: parsed.data.trigger ? (parsed.data.trigger as BadgeTrigger) : undefined,
      imageUrl: parsed.data.imageUrl === "" ? null : parsed.data.imageUrl,
    },
  });

  return NextResponse.json(updated);
}

// DELETE /api/admin/badges/[id]
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user || !isAdmin(session)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const badge = await db.badge.findUnique({ where: { id } });
  if (!badge || badge.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db.badge.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
