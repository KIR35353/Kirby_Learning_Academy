import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const ratingSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(1000).optional(),
});

// GET /api/courses/[id]/rating — get ratings summary + user's own rating
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [agg, userRating, recent] = await Promise.all([
    db.courseRating.aggregate({
      where: { courseId: id },
      _avg: { rating: true },
      _count: { id: true },
    }),
    db.courseRating.findUnique({
      where: { courseId_userId: { courseId: id, userId: session.user.id! } },
    }),
    db.courseRating.findMany({
      where: { courseId: id, comment: { not: null } },
      include: { user: { select: { name: true, displayName: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  return NextResponse.json({
    average: agg._avg.rating ? Math.round(agg._avg.rating * 10) / 10 : null,
    count: agg._count.id,
    userRating: userRating ? { rating: userRating.rating, comment: userRating.comment } : null,
    recent,
  });
}

// POST /api/courses/[id]/rating — submit or update user's rating
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Must have completed the course
  const completed = await db.enrollment.findFirst({
    where: { courseId: id, userId: session.user.id!, status: "COMPLETED" },
  });
  if (!completed) {
    return NextResponse.json({ error: "You must complete the course before rating it." }, { status: 400 });
  }

  const body = await req.json();
  const parsed = ratingSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const rating = await db.courseRating.upsert({
    where: { courseId_userId: { courseId: id, userId: session.user.id! } },
    update: { rating: parsed.data.rating, comment: parsed.data.comment ?? null },
    create: { courseId: id, userId: session.user.id!, rating: parsed.data.rating, comment: parsed.data.comment ?? null },
  });

  return NextResponse.json(rating);
}
