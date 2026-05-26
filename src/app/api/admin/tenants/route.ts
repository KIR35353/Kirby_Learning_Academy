import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { z } from "zod";

async function requireSuperAdmin() {
  const session = await auth();
  if (!session) return { error: "Unauthorized", status: 401 } as const;
  const roles = (session.user as Record<string, unknown>).roles as string[];
  if (!roles.includes("SUPER_ADMIN")) return { error: "Forbidden", status: 403 } as const;
  return { session } as const;
}

export async function GET() {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const tenants = await db.tenant.findMany({
    orderBy: { name: "asc" },
    include: {
      _count: {
        select: { users: true, departments: true, businessUnits: true },
      },
    },
  });

  return NextResponse.json(tenants);
}

const createSchema = z.object({
  name: z.string().min(1).max(100),
  slug: z.string().min(1).max(50).regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  domain: z.string().regex(/^[a-z0-9][a-z0-9.-]*\.[a-z]{2,}$/, "Invalid domain format").nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  departments: z.array(z.string().min(1)).optional(),
  locations: z.array(z.string().min(1)).optional(),
});

export async function POST(request: Request) {
  const check = await requireSuperAdmin();
  if ("error" in check) return NextResponse.json({ error: check.error }, { status: check.status });

  const body = await request.json() as unknown;
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const existing = await db.tenant.findUnique({ where: { slug: parsed.data.slug } });
  if (existing) return NextResponse.json({ error: "Slug already in use" }, { status: 409 });

  if (parsed.data.domain) {
    const domainTaken = await db.tenant.findUnique({ where: { domain: parsed.data.domain } });
    if (domainTaken) return NextResponse.json({ error: "Domain already in use" }, { status: 409 });
  }

  const { departments, locations, ...tenantData } = parsed.data;

  const tenant = await db.$transaction(async (tx) => {
    const created = await tx.tenant.create({ data: tenantData });
    if (departments?.length) {
      await tx.department.createMany({
        data: departments.map((name) => ({ name: name.trim(), tenantId: created.id })),
        skipDuplicates: true,
      });
    }
    if (locations?.length) {
      await tx.location.createMany({
        data: locations.map((name) => ({ name: name.trim(), tenantId: created.id })),
        skipDuplicates: true,
      });
    }
    return created;
  });

  return NextResponse.json(tenant, { status: 201 });
}
