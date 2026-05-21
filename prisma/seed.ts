/**
 * Prisma seed — creates default roles, tenant, and admin user.
 * Run: npx prisma db seed
 */
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import bcrypt from "bcryptjs";

const connectionString = process.env["DATABASE_URL"];
if (!connectionString) throw new Error("DATABASE_URL is not set");
const adapter = new PrismaPg({ connectionString });
const db = new PrismaClient({ adapter } as ConstructorParameters<typeof PrismaClient>[0]);

const ROLES = [
  { name: "SUPER_ADMIN", description: "Full platform access across all tenants" },
  { name: "TENANT_ADMIN", description: "Admin for a single business unit" },
  {
    name: "COMPLIANCE_OFFICER",
    description: "Read/write compliance records and reports",
  },
  { name: "MANAGER", description: "Assign courses and view team reports" },
  { name: "INSTRUCTOR", description: "Create and manage courses" },
  { name: "EMPLOYEE", description: "Enroll in and complete courses" },
  { name: "CONTRACTOR", description: "Restricted catalog access" },
];

async function main() {
  console.log("🌱  Seeding database…");

  // 1. Upsert roles
  for (const role of ROLES) {
    await db.role.upsert({
      where: { name: role.name },
      update: { description: role.description },
      create: role,
    });
  }
  console.log(`✔  ${ROLES.length} roles seeded`);

  // 2. Default tenant
  const tenant = await db.tenant.upsert({
    where: { slug: "kirby-corp" },
    update: {},
    create: {
      name: "Kirby Corporation",
      slug: "kirby-corp",
    },
  });
  console.log(`✔  Tenant: ${tenant.name}`);

  // 3. Sample departments
  const deptNames = [
    "Marine Operations",
    "Distribution & Services",
    "Safety & Compliance",
    "Information Technology",
    "Human Resources",
    "Finance",
  ];
  for (const name of deptNames) {
    await db.department.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name } },
      update: {},
      create: { name, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${deptNames.length} departments seeded`);

  // 4. Sample locations
  const locationNames = [
    { name: "Houston, TX HQ", city: "Houston", state: "TX" },
    { name: "New Orleans, LA", city: "New Orleans", state: "LA" },
    { name: "Tampa, FL", city: "Tampa", state: "FL" },
  ];
  for (const loc of locationNames) {
    await db.location.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: loc.name } },
      update: {},
      create: { ...loc, tenantId: tenant.id },
    });
  }
  console.log(`✔  ${locationNames.length} locations seeded`);

  // 5. Admin user
  const adminEmail = process.env.ADMIN_EMAIL ?? "admin@kirbycorp.com";
  const adminPassword = process.env.ADMIN_PASSWORD ?? "KLA.adm1n";
  const passwordHash = await bcrypt.hash(adminPassword, 12);

  const superAdminRole = await db.role.findUnique({ where: { name: "SUPER_ADMIN" } });

  const admin = await db.user.upsert({
    where: { email: adminEmail },
    update: {
      // Always sync the password and keep the account active on re-seed
      passwordHash,
      isActive: true,
    },
    create: {
      email: adminEmail,
      name: "KLA Administrator",
      passwordHash,
      tenantId: tenant.id,
      isActive: true,
      roles: superAdminRole
        ? { create: [{ roleId: superAdminRole.id }] }
        : undefined,
    },
  });

  // Ensure SUPER_ADMIN role is attached even if the user already existed
  if (superAdminRole) {
    await db.userRole.upsert({
      where: { userId_roleId: { userId: admin.id, roleId: superAdminRole.id } },
      update: {},
      create: { userId: admin.id, roleId: superAdminRole.id },
    });
  }

  console.log(`✔  Admin user: ${admin.email} (password synced)`);
  if (!process.env.ADMIN_PASSWORD) {
    console.log(`    ℹ  Using default password. Set ADMIN_PASSWORD in .env to override.`);
  }

  console.log("\n✅  Seed complete.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
