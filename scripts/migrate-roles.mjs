// One-shot migration: EMPLOYEE→STUDENT, remove COMPLIANCE_OFFICER + CONTRACTOR
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

const db = new PrismaClient();

try {
  // 1. Rename EMPLOYEE → STUDENT
  const renamed = await db.role.updateMany({
    where: { name: "EMPLOYEE" },
    data: { name: "STUDENT", description: "Enroll in and complete courses" },
  });
  console.log("Renamed EMPLOYEE→STUDENT:", renamed.count);

  // 2. Get STUDENT role id
  const student = await db.role.findUnique({ where: { name: "STUDENT" } });
  if (!student) throw new Error("STUDENT role not found after rename");

  // 3. Reassign any user_roles pointing at old roles to STUDENT, then delete old roles
  for (const oldName of ["COMPLIANCE_OFFICER", "CONTRACTOR"]) {
    const old = await db.role.findUnique({ where: { name: oldName } });
    if (!old) { console.log(`${oldName} not found — skipping`); continue; }

    const affected = await db.userRole.findMany({ where: { roleId: old.id } });
    for (const ur of affected) {
      await db.userRole.upsert({
        where: { userId_roleId: { userId: ur.userId, roleId: student.id } },
        create: { userId: ur.userId, roleId: student.id },
        update: {},
      });
    }
    await db.userRole.deleteMany({ where: { roleId: old.id } });
    await db.role.delete({ where: { id: old.id } });
    console.log(`Removed role ${oldName} (reassigned ${affected.length} user(s) to STUDENT)`);
  }

  const roles = await db.role.findMany({ orderBy: { name: "asc" }, select: { name: true } });
  console.log("Final roles:", roles.map((r) => r.name).join(", "));
} finally {
  await db.$disconnect();
}
