import { db } from "@/lib/db";

/**
 * Given a user's email address, extract the domain and look up the matching
 * Tenant.  Returns the tenant's id, or null if no tenant has that domain
 * registered.
 */
export async function resolveTenantIdFromEmail(
  email: string,
): Promise<string | null> {
  const domain = email.split("@")[1]?.toLowerCase();
  if (!domain) return null;
  const tenant = await db.tenant.findUnique({ where: { domain } });
  return tenant?.id ?? null;
}
