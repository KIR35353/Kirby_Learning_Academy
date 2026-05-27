import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { z } from "zod";

const createSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  category: z.string().optional(),
  targetAudience: z.string().optional(),
  complianceTags: z.array(z.string()).optional().default([]),
  isContractorVisible: z.boolean().optional().default(false),
  tags: z.array(z.string()).optional().default([]),
  languages: z.array(z.string()).optional().default(["en"]),
  tenantIds: z.array(z.string()).optional().default([]),
});

// GET /api/admin/courses — list courses for tenant
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const category = searchParams.get("category");
  const q = searchParams.get("q");

  const courses = await db.course.findMany({
    where: {
      ...(isSuperAdmin
        ? {}
        : { courseTenants: { some: { tenantId: session.user.tenantId } } }),
      ...(status ? { status: status as never } : {}),
      ...(category ? { category } : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { description: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      tags: true,
      languages: true,
      courseTenants: { select: { tenantId: true } },
      activeVersion: { select: { versionNumber: true, s3Prefix: true } },
      _count: { select: { versions: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json(courses);
}

// POST /api/admin/courses — create a new course record (no content yet)
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN") || roles.includes("INSTRUCTOR");
  if (!isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  const body = await req.json();
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const { tags, languages, tenantIds, ...data } = parsed.data;

  const selectedTenantIds = isSuperAdmin
    ? (tenantIds.length > 0 ? Array.from(new Set(tenantIds)) : [session.user.tenantId])
    : [session.user.tenantId];

  if (isSuperAdmin) {
    const tenantCount = await db.tenant.count({ where: { id: { in: selectedTenantIds } } });
    if (tenantCount !== selectedTenantIds.length) {
      return NextResponse.json({ error: "One or more tenantIds are invalid" }, { status: 400 });
    }
  }

  const course = await db.course.create({
    data: {
      ...data,
      tenantId: selectedTenantIds[0],
      createdById: session.user.id,
      courseTenants: {
        create: selectedTenantIds.map((tenantId) => ({
          tenantId,
          assignedById: session.user.id,
        })),
      },
      tags: { create: tags.map((tag) => ({ tag })) },
      languages: {
        create: languages.map((lang, i) => ({ language: lang, isDefault: i === 0 })),
      },
    },
    include: { tags: true, languages: true, courseTenants: { select: { tenantId: true } } },
  });

  return NextResponse.json(course, { status: 201 });
}
