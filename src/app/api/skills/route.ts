import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/skills — current user's skill profile
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const userSkills = await db.userSkill.findMany({
    where: { userId: session.user.id },
    include: {
      skill: {
        include: { category: { select: { id: true, name: true } } },
      },
      endorsedBy: { select: { id: true, name: true } },
    },
    orderBy: [{ skill: { category: { name: "asc" } } }, { skill: { name: "asc" } }],
  });
  return NextResponse.json(userSkills);
}
