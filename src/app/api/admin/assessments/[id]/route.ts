import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import type { Session } from "next-auth";
import { db } from "@/lib/db";
import { z } from "zod";

function isAdmin(session: Session | null): boolean {
  const roles = session?.user?.roles ?? [];
  return roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR") || roles.includes("COMPLIANCE_OFFICER");
}

const metaSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]).optional(),
  passingScore: z.number().int().min(1).max(100).optional(),
  maxAttempts: z.number().int().min(1).nullable().optional(),
  timeLimitMinutes: z.number().int().min(1).nullable().optional(),
  randomizeQuestions: z.boolean().optional(),
  questionsPerAttempt: z.number().int().min(1).nullable().optional(),
  remediationCourseId: z.string().nullable().optional(),
});

const questionOptionSchema = z.object({
  id: z.string().optional(),       // existing option id (omit for new)
  text: z.string().min(1),
  isCorrect: z.boolean().default(false),
  order: z.number().int().default(0),
});

const questionSchema = z.object({
  id: z.string().optional(),       // existing question id (omit for new)
  type: z.enum(["MULTIPLE_CHOICE", "TRUE_FALSE", "MULTI_SELECT", "ATTESTATION"]),
  text: z.string().min(1),
  explanation: z.string().optional(),
  points: z.number().int().default(1),
  order: z.number().int().default(0),
  tags: z.array(z.string()).default([]),
  options: z.array(questionOptionSchema).default([]),
});

const questionsSchema = z.object({
  questions: z.array(questionSchema),
});

// GET /api/admin/assessments/[id]
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const assessment = await db.standaloneAssessment.findFirst({
    where: { id, tenantId: session.user.tenantId },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
      assignments: {
        include: {
          user: { select: { id: true, name: true, email: true } },
          department: { select: { id: true, name: true } },
        },
        orderBy: { assignedAt: "desc" },
      },
      remediationCourse: { select: { id: true, title: true } },
      _count: { select: { attempts: true } },
    },
  });

  if (!assessment) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(assessment);
}

// PATCH /api/admin/assessments/[id]
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.standaloneAssessment.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await req.json();

  if ("assign" in body) {
    // Create an assignment
    const a = body.assign as Record<string, string>;
    await db.assessmentAssignment.create({
      data: {
        assessmentId: id,
        tenantId: session.user.tenantId!,
        roleName: a.roleName ?? null,
        departmentId: a.departmentId ?? null,
        userId: a.userId ?? null,
        dueDate: a.dueDate ? new Date(a.dueDate) : null,
      },
    });
    const updated2 = await db.standaloneAssessment.findUnique({
      where: { id },
      include: { _count: { select: { attempts: true, assignments: true, questions: true } } },
    });
    return NextResponse.json(updated2);
  }

  if ("questions" in body) {
    // Full question replacement
    const parsed = questionsSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

    await db.$transaction(async (tx) => {
      // Delete existing questions (cascades to options and answers)
      await tx.question.deleteMany({ where: { assessmentId: id } });

      // Re-create all questions with options
      for (const q of parsed.data.questions) {
        await tx.question.create({
          data: {
            assessmentId: id,
            type: q.type,
            text: q.text,
            explanation: q.explanation,
            points: q.points,
            order: q.order,
            tags: q.tags,
            options: {
              create: q.options.map((o) => ({
                text: o.text,
                isCorrect: o.isCorrect,
                order: o.order,
              })),
            },
          },
        });
      }
    });
  } else {
    const parsed = metaSchema.safeParse(body);
    if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    await db.standaloneAssessment.update({ where: { id }, data: parsed.data });
  }

  const updated = await db.standaloneAssessment.findUnique({
    where: { id },
    include: {
      questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      _count: { select: { attempts: true } },
    },
  });
  return NextResponse.json(updated);
}

// DELETE /api/admin/assessments/[id]
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user || !isAdmin(session))
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { id } = await params;
  const existing = await db.standaloneAssessment.findFirst({ where: { id, tenantId: session.user.tenantId } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.standaloneAssessment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
