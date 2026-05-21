import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  body: z.string().min(1),   // first post body
  categoryId: z.string(),
});

// GET /api/forums/threads?categoryId=xxx&page=1
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  const where = {
    ...(categoryId ? { categoryId } : {}),
  };

  const [threads, total] = await Promise.all([
    db.forumThread.findMany({
      where,
      include: {
        author: { select: { id: true, name: true, displayName: true } },
        category: { select: { id: true, name: true } },
        _count: { select: { posts: true } },
      },
      orderBy: [{ isPinned: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.forumThread.count({ where }),
  ]);

  return NextResponse.json({ data: threads, meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) } });
}

// POST /api/forums/threads — create thread + first post
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const category = await db.forumCategory.findUnique({ where: { id: parsed.data.categoryId } });
  if (!category || category.tenantId !== session.user.tenantId) {
    return NextResponse.json({ error: "Category not found" }, { status: 404 });
  }
  if (!category.isActive) return NextResponse.json({ error: "Category is closed" }, { status: 403 });

  const thread = await db.forumThread.create({
    data: {
      categoryId: parsed.data.categoryId,
      authorId: session.user.id!,
      title: parsed.data.title,
      postCount: 1,
      posts: {
        create: {
          authorId: session.user.id!,
          body: parsed.data.body,
        },
      },
    },
    include: {
      author: { select: { id: true, name: true, displayName: true } },
      posts: { orderBy: { createdAt: "asc" }, take: 1 },
    },
  });

  return NextResponse.json(thread, { status: 201 });
}
