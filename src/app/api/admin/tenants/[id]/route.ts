import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 } as const;
  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN")) return { error: "Forbidden", status: 403 } as const;
  return { session } as const;
}

const updateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  logoUrl: z.string().url().nullable().optional(),
});

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const tenant = await db.tenant.findUnique({ where: { id } });
  if (!tenant) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await request.json() as unknown;
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.tenant.update({ where: { id }, data: parsed.data });
  return NextResponse.json(updated);
}
