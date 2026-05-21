import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

const createSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  framework: z.enum(["OSHA", "USCG", "EPA", "ISM_CODE", "STCW", "DOT", "INTERNAL"]).default("INTERNAL"),
  type: z.enum(["INITIAL", "RENEWAL", "RECERTIFICATION"]).default("INITIAL"),
  validityDays: z.number().int().min(1).nullable().optional(),
  renewalWindowDays: z.number().int().min(1).default(90),
  renewalCourseId: z.string().nullable().optional(),
});

// GET /api/admin/certifications
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const certs = await db.certification.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      renewalCourse: { select: { id: true, title: true } },
      _count: { select: { records: true, requirements: true } },
    },
    orderBy: [{ framework: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(certs);
}

// POST /api/admin/certifications
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const cert = await db.certification.create({
    data: {
      tenantId: session.user.tenantId!,
      ...parsed.data,
      validityDays: parsed.data.validityDays ?? null,
      renewalCourseId: parsed.data.renewalCourseId ?? null,
    },
    include: {
      renewalCourse: { select: { id: true, title: true } },
      _count: { select: { records: true, requirements: true } },
    },
  });

  await db.auditLog.create({
    data: {
      tenantId: session.user.tenantId!,
      action: "CERT_ISSUED",
      actorId: session.user.id,
      entityId: cert.id,
      entityType: "Certification",
      meta: { name: cert.name },
    },
  });

  return NextResponse.json(cert, { status: 201 });
}
