/**
 * HRIS Sync Engine
 *
 * Processes a batch of HrisUser records from any adapter and applies them
 * to the KLA database:
 *
 *  - Auto-provisions new users (creates account, assigns EMPLOYEE role)
 *  - Updates changed fields (name, department, location, jobTitle, businessUnit)
 *  - Detects role changes → emits "role-change" event for training reassignment
 *  - Detects new hire dates → emits "new-hire" event for onboarding path
 *  - Deactivates terminated employees (sets isActive=false, terminatedAt)
 *
 * Returns a summary that is persisted as an HrisSyncLog record.
 */
import { db } from "@/lib/db";
import { emitHrisEvent } from "./events";
import type { HrisUser } from "./types";

export interface SyncResult {
  recordsIn: number;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[];
}

/**
 * Strip BOM, invisible Unicode (zero-width spaces, soft hyphen, etc.),
 * C0/C1 control characters, and surrounding whitespace from org names.
 * Plain `.trim()` does not remove these characters.
 */
function sanitizeOrgName(name: string): string {
  return name
    .replace(/[\uFEFF\u200B\u200C\u200D\u00AD\u2060\uFFFE]/g, "") // BOM + invisible Unicode
    .replace(/[\x00-\x1F\x7F]/g, "")                               // control chars
    .trim();
}

async function upsertOrgRecord(
  model: "department" | "location" | "jobTitle" | "businessUnit",
  tenantId: string,
  rawName: string,
): Promise<string> {
  const name = sanitizeOrgName(rawName);
  if (!name) throw new Error(`Empty org name after sanitization (raw: ${JSON.stringify(rawName)})`);

  if (model === "department") {
    const rec = await db.department.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { name, tenantId },
    });
    return rec.id;
  }
  if (model === "location") {
    const rec = await db.location.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { name, tenantId },
    });
    return rec.id;
  }
  if (model === "jobTitle") {
    const rec = await db.jobTitle.upsert({
      where: { tenantId_name: { tenantId, name } },
      update: {},
      create: { name, tenantId },
    });
    return rec.id;
  }
  // businessUnit
  const rec = await db.businessUnit.upsert({
    where: { tenantId_name: { tenantId, name } },
    update: {},
    create: { name, tenantId },
  });
  return rec.id;
}

export async function runHrisSync(
  tenantId: string,
  source: "workday" | "successfactors" | "csv",
  hrisUsers: HrisUser[],
): Promise<SyncResult> {
  const result: SyncResult = {
    recordsIn: hrisUsers.length,
    created: 0,
    updated: 0,
    deactivated: 0,
    errors: [],
  };

  const employeeRole = await db.role.findUnique({ where: { name: "STUDENT" } });
  if (!employeeRole) {
    result.errors.push("STUDENT role not found in database — run db:seed first");
    return result;
  }

  for (const hrisUser of hrisUsers) {
    try {
      // Resolve org FK ids (upsert so unknown departments/locations auto-create)
      const [departmentId, locationId, jobTitleId, businessUnitId] = await Promise.all([
        hrisUser.departmentName
          ? upsertOrgRecord("department", tenantId, hrisUser.departmentName)
          : Promise.resolve(null),
        hrisUser.locationName
          ? upsertOrgRecord("location", tenantId, hrisUser.locationName)
          : Promise.resolve(null),
        hrisUser.jobTitleName
          ? upsertOrgRecord("jobTitle", tenantId, hrisUser.jobTitleName)
          : Promise.resolve(null),
        hrisUser.businessUnitName
          ? upsertOrgRecord("businessUnit", tenantId, hrisUser.businessUnitName)
          : Promise.resolve(null),
      ]);

      const isTerminated =
        !!hrisUser.terminatedAt && hrisUser.terminatedAt <= new Date();

      const existing = await db.user.findFirst({
        where: {
          tenantId,
          OR: [
            { email: hrisUser.email },
            ...(hrisUser.hrisId ? [{ hrisId: hrisUser.hrisId }] : []),
          ],
        },
        include: { roles: { include: { role: true } } },
      });

      if (!existing) {
        // ── New user: auto-provision ─────────────────────────────────────────
        if (isTerminated) continue; // don't provision already-terminated users

        await db.user.create({
          data: {
            email: hrisUser.email,
            name: hrisUser.name,
            tenantId,
            hrisId: hrisUser.hrisId,
            hrisSource: source,
            lastHrisSyncAt: new Date(),
            hireDate: hrisUser.hireDate,
            isContractor: hrisUser.isContractor ?? false,
            isActive: true,
            departmentId: departmentId ?? undefined,
            locationId: locationId ?? undefined,
            jobTitleId: jobTitleId ?? undefined,
            businessUnitId: businessUnitId ?? undefined,
            roles: {
              create: { roleId: employeeRole.id },
            },
          },
        });

        result.created++;

        if (hrisUser.hireDate) {
          await emitHrisEvent("new-hire", {
            tenantId,
            email: hrisUser.email,
            hireDate: hrisUser.hireDate,
          });
        }
      } else {
        // ── Existing user: detect changes ────────────────────────────────────
        if (isTerminated && existing.isActive) {
          await db.user.update({
            where: { id: existing.id },
            data: {
              isActive: false,
              terminatedAt: hrisUser.terminatedAt,
              lastHrisSyncAt: new Date(),
            },
          });
          result.deactivated++;
          continue;
        }

        // Detect job title change → role-change event
        const jobTitleChanged =
          hrisUser.jobTitleName &&
          existing.jobTitleId !== jobTitleId;

        await db.user.update({
          where: { id: existing.id },
          data: {
            name: hrisUser.name,
            hrisId: hrisUser.hrisId,
            hrisSource: source,
            lastHrisSyncAt: new Date(),
            hireDate: hrisUser.hireDate ?? existing.hireDate,
            isContractor: hrisUser.isContractor ?? existing.isContractor,
            departmentId: departmentId ?? existing.departmentId,
            locationId: locationId ?? existing.locationId,
            jobTitleId: jobTitleId ?? existing.jobTitleId,
            businessUnitId: businessUnitId ?? existing.businessUnitId,
          },
        });

        result.updated++;

        if (jobTitleChanged) {
          await emitHrisEvent("role-change", {
            tenantId,
            userId: existing.id,
            previousJobTitleId: existing.jobTitleId ?? undefined,
            newJobTitleName: hrisUser.jobTitleName,
          });
        }
      }
    } catch (err) {
      result.errors.push(
        `[${hrisUser.email}] ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  return result;
}
