import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const postSchema = z.object({ body: z.string().min(1) });

// GET /api/forums/threads/[id]/posts?page=1
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") ?? "1");
  const pageSize = 20;

  // Bump view count
  await db.forumThread.update({ where: { id }, data: { viewCount: { increment: 1 } } });

  const [thread, posts, total] = await Promise.all([
    db.forumThread.findUnique({
      where: { id },
      include: {
        author: { select: { id: true, name: true, displayName: true } },
        category: { select: { id: true, name: true } },
      },
    }),
    db.forumPost.findMany({
      where: { threadId: id },
      include: { author: { select: { id: true, name: true, displayName: true } } },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    db.forumPost.count({ where: { threadId: id } }),
  ]);

  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });

  return NextResponse.json({ thread, posts, meta: { total, page, pageSize, pages: Math.ceil(total / pageSize) } });
}

// POST /api/forums/threads/[id]/posts — add a reply
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const thread = await db.forumThread.findUnique({ where: { id } });
  if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (thread.isLocked) return NextResponse.json({ error: "Thread is locked" }, { status: 403 });

  const body = await req.json();
  const parsed = postSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const [post] = await db.$transaction([
    db.forumPost.create({
      data: { threadId: id, authorId: session.user.id!, body: parsed.data.body },
      include: { author: { select: { id: true, name: true, displayName: true } } },
    }),
    db.forumThread.update({
      where: { id },
      data: { postCount: { increment: 1 }, updatedAt: new Date() },
    }),
  ]);

  return NextResponse.json(post, { status: 201 });
}
