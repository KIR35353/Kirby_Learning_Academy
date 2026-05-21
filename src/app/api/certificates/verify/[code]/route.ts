import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// GET /api/certificates/verify/[code] — public cert verification endpoint
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params;

  const cert = await db.digitalCertificate.findUnique({
    where: { verifyCode: code },
    include: { user: { select: { name: true } } },
  });

  if (!cert) {
    return NextResponse.json({ valid: false, error: "Certificate not found" }, { status: 404 });
  }

  const expired = cert.expiresAt && cert.expiresAt < new Date();

  return NextResponse.json({
    valid: !expired,
    certificate: {
      title: cert.title,
      recipientName: cert.recipientName,
      issuerName: cert.issuerName,
      issuedAt: cert.issuedAt,
      expiresAt: cert.expiresAt,
      expired: !!expired,
    },
  });
}
