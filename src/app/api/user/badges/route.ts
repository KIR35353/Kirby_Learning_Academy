import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/user/badges — current user's awarded badges
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userBadges = await db.userBadge.findMany({
    where: { userId: session.user.id! },
    include: { badge: true },
    orderBy: { awardedAt: "desc" },
  });

  return NextResponse.json(userBadges);
}
