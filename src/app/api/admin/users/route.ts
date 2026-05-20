import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  password: z.string().min(8).optional(),
  isContractor: z.boolean().default(false),
  departmentId: z.string().optional(),
  locationId: z.string().optional(),
  jobTitleId: z.string().optional(),
  hireDate: z.string().optional(),
  roleNames: z.array(z.string()).default(["EMPLOYEE"]),
});

// GET /api/admin/users — list users (admins only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") ?? "";
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const locationId = searchParams.get("locationId") ?? undefined;
  const isActive = searchParams.get("isActive");
  const isContractor = searchParams.get("isContractor");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10)));
  const skip = (page - 1) * limit;

  const where = {
    tenantId,
    ...(search && {
      OR: [
        { email: { contains: search, mode: "insensitive" as const } },
        { name: { contains: search, mode: "insensitive" as const } },
      ],
    }),
    ...(departmentId && { departmentId }),
    ...(locationId && { locationId }),
    ...(isActive !== null && isActive !== "" && { isActive: isActive === "true" }),
    ...(isContractor !== null && isContractor !== "" && {
      isContractor: isContractor === "true",
    }),
  };

  const [users, total] = await Promise.all([
    db.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: "asc" },
      select: {
        id: true,
        email: true,
        name: true,
        displayName: true,
        avatarUrl: true,
        isActive: true,
        isContractor: true,
        hireDate: true,
        createdAt: true,
        department: { select: { id: true, name: true } },
        location: { select: { id: true, name: true } },
        jobTitle: { select: { id: true, name: true } },
        roles: { select: { role: { select: { id: true, name: true } } } },
      },
    }),
    db.user.count({ where }),
  ]);

  return NextResponse.json({
    users,
    pagination: { page, limit, total, pages: Math.ceil(total / limit) },
  });
}

// POST /api/admin/users — create user
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createUserSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { email, name, password, isContractor, departmentId, locationId, jobTitleId, hireDate, roleNames } = parsed.data;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const passwordHash = password ? await bcrypt.hash(password, 12) : null;

  // Resolve role IDs
  const roleRecords = await db.role.findMany({
    where: { name: { in: roleNames } },
  });

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      isContractor,
      tenantId,
      departmentId: departmentId || null,
      locationId: locationId || null,
      jobTitleId: jobTitleId || null,
      hireDate: hireDate ? new Date(hireDate) : null,
      roles: {
        create: roleRecords.map((r: { id: string }) => ({ roleId: r.id })),
      },
    },
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      isContractor: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ user }, { status: 201 });
}
