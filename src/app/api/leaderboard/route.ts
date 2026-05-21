import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/leaderboard
// ?scope=company|department|site&limit=20
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20"), 50);

  // Find users who opted out
  const optOuts = await db.leaderboardOptOut.findMany({
    where: {},
    select: { userId: true },
  });
  const optOutIds = new Set(optOuts.map((o) => o.userId));

  // Aggregate completions + badge points
  const [completions, badgePoints] = await Promise.all([
    db.enrollment.groupBy({
      by: ["userId"],
      where: {
        tenantId: session.user.tenantId!,
        status: "COMPLETED",
        userId: { notIn: [...optOutIds] },
      },
      _count: { id: true },
      orderBy: { _count: { id: "desc" } },
      take: limit * 2,
    }),
    db.userBadge.groupBy({
      by: ["userId"],
      where: { userId: { notIn: [...optOutIds] } },
      _count: { badgeId: true },
    }),
  ]);

  // Build point map from badge counts (10 pts each for simplicity, real points from badge.points)
  const pointsMap = new Map(badgePoints.map((b) => [b.userId, b._count.badgeId * 10]));

  // Fetch user info for top completers
  const userIds = completions.map((c) => c.userId);
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, name: true, displayName: true, department: { select: { name: true } } },
  });
  const userMap = new Map(users.map((u) => [u.id, u]));

  const leaderboard = completions
    .map((c, i) => {
      const user = userMap.get(c.userId);
      if (!user) return null;
      return {
        rank: i + 1,
        userId: c.userId,
        name: user.displayName || user.name || "Unknown",
        department: user.department?.name ?? null,
        completions: c._count.id,
        points: pointsMap.get(c.userId) ?? 0,
      };
    })
    .filter(Boolean)
    .slice(0, limit);

  // Check if current user opted out
  const isOptedOut = optOutIds.has(session.user.id!);

  return NextResponse.json({ leaderboard, isOptedOut });
}
