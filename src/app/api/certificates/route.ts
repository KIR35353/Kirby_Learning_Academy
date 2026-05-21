import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/certificates — list user's digital certificates
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const certs = await db.digitalCertificate.findMany({
    where: { userId: session.user.id! },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json(certs);
}
