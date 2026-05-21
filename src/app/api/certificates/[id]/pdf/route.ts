import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { renderToBuffer } from "@react-pdf/renderer";
import { createElement, type ReactElement } from "react";
import type { DocumentProps } from "@react-pdf/renderer";
import { CertificatePDF } from "@/lib/certificate-pdf";
import QRCode from "qrcode";

// GET /api/certificates/[id]/pdf — stream the PDF for a certificate
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cert = await db.digitalCertificate.findUnique({ where: { id } });
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Only owner can download their cert
  if (cert.userId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Generate QR code data URL
  const verifyUrl = `${process.env.NEXTAUTH_URL ?? "https://kirbyacademy.com"}/verify/${cert.verifyCode}`;
  let qrDataUrl: string | undefined;
  try {
    qrDataUrl = await QRCode.toDataURL(verifyUrl, { margin: 1, color: { dark: "#ffffff", light: "#0a1628" } });
  } catch { /* skip if fails */ }

  const element = createElement(CertificatePDF, {
    recipientName: cert.recipientName,
    courseTitle: cert.title,
    issuerName: cert.issuerName,
    issuedAt: cert.issuedAt,
    expiresAt: cert.expiresAt,
    verifyCode: cert.verifyCode,
    qrDataUrl,
  }) as ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  const filename = `certificate-${cert.verifyCode}.pdf`;
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
