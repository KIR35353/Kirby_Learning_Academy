import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().optional(),
  courseId: z.string().optional(),
});

// GET /api/forums/categories
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const categories = await db.forumCategory.findMany({
    where: { tenantId: session.user.tenantId!, isActive: true },
    include: {
      course: { select: { id: true, title: true } },
      _count: { select: { threads: true } },
    },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  return NextResponse.json(categories);
}

// POST /api/forums/categories — admin only
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const isAdmin = (session?.user?.roles ?? []).some((r) => ["SUPER_ADMIN", "TENANT_ADMIN"].includes(r));
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cat = await db.forumCategory.create({
    data: { ...parsed.data, tenantId: session.user.tenantId! },
  });
  return NextResponse.json(cat, { status: 201 });
}
