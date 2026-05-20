import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const token = typeof body?.token === "string" ? body.token : "";
    const password = typeof body?.password === "string" ? body.password : "";

    if (!token || !password) {
      return NextResponse.json(
        { error: "Token and password are required" },
        { status: 400 },
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 },
      );
    }

    const resetToken = await db.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!resetToken || resetToken.used || resetToken.expires < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired" },
        { status: 400 },
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.$transaction([
      db.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash },
      }),
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { used: true },
      }),
      // Invalidate all sessions for security
      db.session.deleteMany({
        where: { userId: resetToken.userId },
      }),
    ]);

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[reset-password]", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
