import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

async function requireAdmin() {
  const session = await auth();
  if (!session) return null;
  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) return null;
  return session;
}

// GET /api/admin/tenants/[id]/locations
export async function GET(_req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  const rows = await db.location.findMany({
    where: { tenantId: id },
    orderBy: { name: "asc" },
    select: { id: true, name: true, _count: { select: { users: true } } },
  });

  return NextResponse.json({
    locations: rows.map((r) => ({ id: r.id, name: r.name, userCount: r._count.users })),
  });
}

const createSchema = z.object({ name: z.string().min(1) });

// POST /api/admin/tenants/[id]/locations
export async function POST(req: NextRequest, { params }: Params) {
  const session = await requireAdmin();
  if (!session) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: "Invalid JSON" }, { status: 400 }); }

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Name is required" }, { status: 400 });

  try {
    const location = await db.location.create({
      data: { name: parsed.data.name.trim(), tenantId: id },
      select: { id: true, name: true },
    });
    return NextResponse.json({ location: { ...location, userCount: 0 } }, { status: 201 });
  } catch {
    return NextResponse.json({ error: "Location name already exists" }, { status: 409 });
  }
}
