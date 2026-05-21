import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR") || roles.includes("COMPLIANCE_OFFICER");
}

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  type: z.enum(["QUIZ", "ATTESTATION"]).default("QUIZ"),
  passingScore: z.number().int().min(1).max(100).default(80),
  maxAttempts: z.number().int().min(1).optional(),
  timeLimitMinutes: z.number().int().min(1).optional(),
  randomizeQuestions: z.boolean().default(false),
  questionsPerAttempt: z.number().int().min(1).optional(),
  remediationCourseId: z.string().optional(),
});

// GET /api/admin/assessments
export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const assessments = await db.standaloneAssessment.findMany({
    where: { tenantId: session.user.tenantId },
    include: {
      _count: { select: { questions: true, attempts: true, assignments: true } },
      remediationCourse: { select: { id: true, title: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(assessments);
}

// POST /api/admin/assessments
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const assessment = await db.standaloneAssessment.create({
    data: {
      tenantId: session.user.tenantId,
      createdById: session.user.id,
      ...parsed.data,
    },
    include: { _count: { select: { questions: true } } },
  });

  return NextResponse.json(assessment, { status: 201 });
}
