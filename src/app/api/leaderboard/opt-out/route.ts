import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// POST /api/leaderboard/opt-out — toggle leaderboard opt-out
export async function POST(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.leaderboardOptOut.findUnique({
    where: { userId: session.user.id! },
  });

  if (existing) {
    await db.leaderboardOptOut.delete({ where: { userId: session.user.id! } });
    return NextResponse.json({ optedOut: false });
  } else {
    await db.leaderboardOptOut.create({ data: { userId: session.user.id! } });
    return NextResponse.json({ optedOut: true });
  }
}
