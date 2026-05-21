import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

// GET /api/enrollments/[id]
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const enrollment = await db.enrollment.findFirst({
    where: { id, userId: session.user.id },
    include: {
      course: {
        include: { activeVersion: true, tags: true },
      },
      courseVersion: true,
    },
  });

  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(enrollment);
}

// DELETE /api/enrollments/[id] — unenroll (own enrollment or admin)
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN");

  const enrollment = await db.enrollment.findFirst({
    where: { id, tenantId: session.user.tenantId },
  });
  if (!enrollment) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Regular users can only unenroll themselves and only if self-enrolled & not started
  if (!isAdmin) {
    if (enrollment.userId !== session.user.id)
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    if (!enrollment.selfEnrolled || enrollment.status !== "NOT_STARTED")
      return NextResponse.json({ error: "Cannot unenroll from an assigned or started course" }, { status: 409 });
  }

  await db.enrollment.delete({ where: { id } });
  return new NextResponse(null, { status: 204 });
}
