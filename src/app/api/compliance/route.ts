import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/compliance — current user's certification status
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const records = await db.certificationRecord.findMany({
    where: { userId: session.user.id },
    include: {
      certification: { select: { id: true, name: true, framework: true, type: true, validityDays: true } },
      history: { orderBy: { changedAt: "desc" }, take: 5 },
    },
    orderBy: [{ certification: { framework: "asc" } }, { certification: { name: "asc" } }],
  });

  return NextResponse.json(records);
}
