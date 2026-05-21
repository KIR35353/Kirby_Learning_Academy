import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { NextResponse } from "next/server";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  code: z.string().max(20).optional(),
  parentId: z.string().nullable().optional(),
  sortOrder: z.number().int().default(0),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;

  const units = await db.businessUnit.findMany({
    where: { tenantId },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { _count: { select: { users: true, departments: true } } },
  });

  return NextResponse.json(units);
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>).tenantId as string;

  const body = await request.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { name, code, parentId, sortOrder } = parsed.data;

  const existing = await db.businessUnit.findUnique({
    where: { tenantId_name: { tenantId, name } },
  });
  if (existing) {
    return NextResponse.json({ error: "A business unit with this name already exists" }, { status: 409 });
  }

  const unit = await db.businessUnit.create({
    data: { name, code, parentId: parentId ?? null, sortOrder, tenantId },
  });

  return NextResponse.json(unit, { status: 201 });
}
