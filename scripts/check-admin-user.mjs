#!/usr/bin/env node
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();

async function main() {
  // Find admin users
  const adminUsers = await db.user.findMany({
    where: {
      roles: {
        some: {
          role: {
            name: {
              in: ["SUPER_ADMIN", "TENANT_ADMIN"],
            },
          },
        },
      },
    },
    include: {
      roles: {
        include: {
          role: true,
        },
      },
    },
  });

  console.log("Admin users found:", adminUsers.length);
  adminUsers.forEach((user) => {
    console.log("---");
    console.log("Email:", user.email);
    console.log("ID:", user.id);
    console.log("Name:", user.name);
    console.log("Display Name:", user.displayName);
    console.log("Is Active:", user.isActive);
    console.log("Roles:", user.roles.map((ur) => ur.role.name));
  });
}

main()
  .then(() => {
    console.log("\nDone!");
    process.exit(0);
  })
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
