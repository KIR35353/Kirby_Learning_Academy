import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { randomBytes } from "crypto";
import { z } from "zod";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { sendEmail, welcomeInviteEmail } from "@/lib/email";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  tenantId: z.string().nullable().optional(),
  isContractor: z.boolean().default(false),
  departmentId: z.string().nullable().optional(),
  locationId: z.string().nullable().optional(),
  jobTitle: z.string().nullable().optional(),
  hireDate: z.string().nullable().optional(),
  roleNames: z.array(z.string()).default(["STUDENT"]),
});

function generateTempPassword(): string {
  // 16 URL-safe chars — uppercase, lowercase, digits, - and _
  return randomBytes(12).toString("base64url").slice(0, 16);
}

// GET /api/admin/users — list users (admins only)
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const roles = (session.user as Record<string, unknown>)?.roles as string[] ?? [];
  if (!roles.includes("SUPER_ADMIN") && !roles.includes("TENANT_ADMIN")) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const isSuperAdmin = roles.includes("SUPER_ADMIN");

  const tenantId = (session.user as Record<string, unknown>)?.tenantId as string;
  const { searchParams } = new URL(req.url);
  const tenantFilterId = searchParams.get("tenantId") ?? undefined;
  const search = searchParams.get("search") ?? "";
  const departmentId = searchParams.get("departmentId") ?? undefined;
  const locationId = searchParams.get("locationId") ?? undefined;
  const isActive = searchParams.get("isActive");
  const isContractor = searchParams.get("isContractor");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(100, Math.max(1, parseInt(searchParams.get("limit") ?? "25", 10)));
  const skip = (page - 1) * limit;

  const where = {
    ...((isSuperAdmin && tenantFilterId)
      ? { tenantId: tenantFilterId }
      : (!isSuperAdmin ? { tenantId } : {})),
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
        tenant: { select: { id: true, name: true } },
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

  const sessionTenantId = (session.user as Record<string, unknown>)?.tenantId as string;

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

  const { email, name, tenantId: bodyTenantId, isContractor, departmentId, locationId, jobTitle, hireDate, roleNames } = parsed.data;

  // SUPER_ADMIN may specify a different tenant; all others inherit their own
  const tenantId =
    roles.includes("SUPER_ADMIN") && bodyTenantId ? bodyTenantId : sessionTenantId;

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email already registered" }, { status: 409 });
  }

  const tempPassword = generateTempPassword();
  const passwordHash = await bcrypt.hash(tempPassword, 12);

  // Resolve role IDs
  const roleRecords = await db.role.findMany({
    where: { name: { in: roleNames } },
  });

  // Resolve freeform job title text → FK (upsert by name within tenant)
  let jobTitleId: string | null = null;
  if (jobTitle?.trim()) {
    const jt = await db.jobTitle.upsert({
      where: { tenantId_name: { tenantId, name: jobTitle.trim() } },
      create: { tenantId, name: jobTitle.trim() },
      update: {},
    });
    jobTitleId = jt.id;
  }

  const user = await db.user.create({
    data: {
      email,
      name,
      passwordHash,
      isContractor,
      tenantId,
      departmentId: departmentId || null,
      locationId: locationId || null,
      jobTitleId,
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

  // Send welcome / invite email (fire-and-forget — don't block the response)
  const loginUrl = `${process.env.NEXTAUTH_URL ?? "http://localhost:3000"}/login`;
  sendEmail({
    to: email,
    subject: "Welcome to Kirby Learning Academy — Your Account is Ready",
    html: welcomeInviteEmail(name, email, tempPassword, loginUrl),
  }).catch((err) =>
    console.error("[api/admin/users] Failed to send invite email:", err),
  );

  return NextResponse.json({ user, tempPassword, loginUrl }, { status: 201 });
}
