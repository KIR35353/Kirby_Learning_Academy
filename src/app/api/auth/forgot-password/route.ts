import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const email = typeof body?.email === "string" ? body.email.toLowerCase().trim() : "";

    if (!email) {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const user = await db.user.findUnique({ where: { email } });

    // Always return 200 to prevent email enumeration
    if (!user || !user.isActive) {
      return NextResponse.json({ ok: true });
    }

    // Invalidate any existing unused tokens for this user
    await db.passwordResetToken.updateMany({
      where: { userId: user.id, used: false },
      data: { used: true },
    });

    const token = crypto.randomBytes(32).toString("hex");
    const expires = new Date(Date.now() + 1000 * 60 * 60); // 1 hour

    await db.passwordResetToken.create({
      data: { token, userId: user.id, expires },
    });

    // TODO: Send email via Resend in Phase 6 (Notifications)
    // For now, log the reset URL in development
    if (process.env.NODE_ENV === "development") {
      console.log(
        `[Password Reset] URL: ${process.env.NEXTAUTH_URL}/reset-password?token=${token}`,
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[forgot-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
