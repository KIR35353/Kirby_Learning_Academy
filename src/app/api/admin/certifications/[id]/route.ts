import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
}

const updateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  framework: z.enum(["OSHA", "USCG", "EPA", "ISM_CODE", "STCW", "DOT", "INTERNAL"]).optional(),
  type: z.enum(["INITIAL", "RENEWAL", "RECERTIFICATION"]).optional(),
  validityDays: z.number().int().min(1).nullable().optional(),
  renewalWindowDays: z.number().int().min(1).optional(),
  renewalCourseId: z.string().nullable().optional(),
  isActive: z.boolean().optional(),
});

// GET /api/admin/certifications/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const cert = await db.certification.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      renewalCourse: { select: { id: true, title: true } },
      requirements: true,
      records: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          issuedBy: { select: { id: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 100,
      },
      _count: { select: { records: true } },
    },
  });
  if (!cert) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(cert);
}

// PATCH /api/admin/certifications/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.certification.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const updated = await db.certification.update({
    where: { id },
    data: parsed.data,
    include: { renewalCourse: { select: { id: true, title: true } }, _count: { select: { records: true, requirements: true } } },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/certifications/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.certification.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.certification.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
