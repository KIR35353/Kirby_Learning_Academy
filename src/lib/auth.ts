import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
import { resolveTenantIdFromEmail } from "@/lib/tenant-domain";
import type { Provider } from "next-auth/providers";

/**
 * AUTH_MODE controls which sign-in methods are available at runtime.
 *   credentials  — email/password only (default)
 *   sso          — Microsoft Entra ID / OIDC only; credentials form is hidden
 *   both         — show both the credentials form and the SSO button
 */
export type AuthMode = "credentials" | "sso" | "both";
export const authMode: AuthMode =
  (process.env.AUTH_MODE as AuthMode | undefined) ?? "credentials";

const credentialsProvider = Credentials({
  name: "credentials",
  credentials: {
    email: { label: "Email", type: "email" },
    password: { label: "Password", type: "password" },
  },
  async authorize(credentials) {
    if (!credentials?.email || !credentials?.password) return null;
    const normalizedEmail = String(credentials.email).trim();
    if (!normalizedEmail) return null;

    const user = await db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: "insensitive",
        },
      },
      include: {
        roles: { include: { role: true } },
        tenant: { select: { logoUrl: true, appName: true, supportEmail: true } },
      },
    });

    if (!user || !user.passwordHash) return null;
    if (!user.isActive) return null;

    const passwordMatch = await bcrypt.compare(
      credentials.password as string,
      user.passwordHash,
    );
    if (!passwordMatch) return null;

    const rolesArray = user.roles.map((ur: { role: { name: string } }) => ur.role.name);
    console.log("[authorize]", { email: user.email, displayName: user.displayName, rolesCount: rolesArray.length });

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
       displayName: user.displayName || user.name || user.email,
      image: user.avatarUrl,
      logoUrl: user.tenant?.logoUrl ?? null,
      appName: user.tenant?.appName ?? null,
      supportEmail: user.tenant?.supportEmail ?? null,
      tenantId: user.tenantId,
      isContractor: user.isContractor,
      roles: rolesArray,
    };
  },
});

/** Returns the ID of the first-created tenant as a catch-all default. */
async function getDefaultTenantId(): Promise<string | null> {
  const tenant = await db.tenant.findFirst({ orderBy: { createdAt: "asc" } });
  return tenant?.id ?? null;
}

/**
 * Microsoft Entra ID (Azure AD) SSO provider.
 * Activated when AUTH_MODE is "sso" or "both".
 * Required env vars:
 *   AUTH_ENTRA_CLIENT_ID
 *   AUTH_ENTRA_CLIENT_SECRET
 *   AUTH_ENTRA_TENANT_ID   (use "common" for multi-tenant / personal accounts)
 */
function buildSsoProvider(): Provider | null {
  const clientId = process.env.AUTH_ENTRA_CLIENT_ID;
  const clientSecret = process.env.AUTH_ENTRA_CLIENT_SECRET;
  const tenantId = process.env.AUTH_ENTRA_TENANT_ID;

  if (!clientId || !clientSecret || !tenantId) {
    console.warn(
      "[auth] AUTH_MODE includes SSO but AUTH_ENTRA_CLIENT_ID / AUTH_ENTRA_CLIENT_SECRET / AUTH_ENTRA_TENANT_ID are not set — SSO provider skipped.",
    );
    return null;
  }

  return MicrosoftEntraId({
    clientId,
    clientSecret,
    issuer: `https://login.microsoftonline.com/${tenantId}/v2.0`,
  });
}

function buildProviders(): Provider[] {
  const providers: Provider[] = [];

  if (authMode === "credentials" || authMode === "both") {
    providers.push(credentialsProvider);
  }

  if (authMode === "sso" || authMode === "both") {
    const sso = buildSsoProvider();
    if (sso) providers.push(sso);
  }

  return providers;
}

// Extend the default PrismaAdapter so that SSO-created users automatically
// get a tenantId derived from their email domain.  Without this override,
// db.user.create would fail because tenantId is a required field.
const baseAdapter = PrismaAdapter(db);
const domainAwareAdapter = {
  ...baseAdapter,
  createUser: async (data: {
    email: string;
    name?: string | null;
    image?: string | null;
    emailVerified?: Date | null;
  }) => {
    const tenantId = await resolveTenantIdFromEmail(data.email);
    if (!tenantId) {
      throw new Error(
        `SSO sign-in rejected: no tenant is registered for the email domain ` +
          `"${data.email.split("@")[1]}". Please contact your administrator.`,
      );
    }
    const user = await db.user.create({
      data: {
        email: data.email,
        name: data.name ?? null,
        avatarUrl: data.image ?? null,
        emailVerified: data.emailVerified ?? null,
        tenantId,
        isActive: true,
      },
    });
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.avatarUrl,
      emailVerified: user.emailVerified,
    };
  },
};

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: domainAwareAdapter,
  trustHost: true,
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        console.log("[jwt:credentials]", { userId: user.id, displayName: (user as any).displayName, rolesCount: (user as any).roles?.length });
        token.id = user.id;
        token.tenantId = (user as { tenantId?: string }).tenantId;
        token.logoUrl = (user as { logoUrl?: string | null }).logoUrl ?? undefined;
        token.appName = (user as { appName?: string | null }).appName ?? undefined;
        token.supportEmail = (user as { supportEmail?: string | null }).supportEmail ?? undefined;
        token.isContractor = (user as { isContractor?: boolean }).isContractor;
        // Ensure roles is always an array of strings
        const userRoles = (user as any).roles;
        token.roles = Array.isArray(userRoles) ? userRoles.filter((r: any) => typeof r === 'string') : [];
        token.displayName = (user as { displayName?: string | null }).displayName || (user as any).name || (user as any).email;
        token.name = (user as { name?: string }).name || (user as any).email;
        console.log("[jwt:token_after]", { displayName: token.displayName, rolesCount: (token.roles as any[])?.length });
        // Fallback: if the user record somehow has no tenant, use the default
        if (!token.tenantId) {
          token.tenantId = (await getDefaultTenantId()) ?? undefined;
        }
      }
      // On SSO sign-in the user record exists in the DB via PrismaAdapter —
      // load tenantId + roles from DB so they land in the JWT.
      if (account?.provider === "microsoft-entra-id" && token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          include: {
            roles: { include: { role: true } },
            tenant: { select: { logoUrl: true, appName: true, supportEmail: true } },
          },
        });
        if (dbUser) {
          token.tenantId = dbUser.tenantId || ((await getDefaultTenantId()) ?? undefined);
          token.logoUrl = dbUser.tenant?.logoUrl ?? undefined;
          token.appName = dbUser.tenant?.appName ?? undefined;
          token.supportEmail = dbUser.tenant?.supportEmail ?? undefined;
          token.isContractor = dbUser.isContractor;
          token.displayName = dbUser.displayName ?? undefined;
          token.name = dbUser.name ?? dbUser.email;
          token.roles = dbUser.roles.map(
            (ur: { role: { name: string } }) => ur.role.name,
          );
        }
      }

      // Backfill display name and roles for existing sessions created before displayName/roles were included in token
      if (token.sub && (!token.displayName || !token.roles || token.roles.length === 0 || token.name === "User")) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          select: { 
            displayName: true, 
            name: true, 
            email: true,
            roles: { include: { role: true } },
            tenant: { select: { logoUrl: true, appName: true, supportEmail: true } },
          },
        });
        if (dbUser) {
          token.displayName = dbUser.displayName ?? undefined;
          token.name = dbUser.name ?? dbUser.email;
          token.logoUrl = dbUser.tenant?.logoUrl ?? undefined;
          token.appName = dbUser.tenant?.appName ?? undefined;
          token.supportEmail = dbUser.tenant?.supportEmail ?? undefined;
          token.roles = dbUser.roles.map((ur: { role: { name: string } }) => ur.role.name);
        }
      }
      return token;
    },
    async session({ session, token }) {
      console.log("[session:input]", { displayName: token.displayName, rolesCount: (token.roles as any[])?.length });
      if (token && session.user) {
        session.user.id = token.id as string;
        const u = session.user as unknown as Record<string, unknown>;
        u.tenantId = token.tenantId;
        u.isContractor = token.isContractor;
        u.roles = token.roles;
        u.displayName = token.displayName;
        u.logoUrl = token.logoUrl;
        u.appName = token.appName;
        u.supportEmail = token.supportEmail;
      }
      console.log("[session:output]", { displayName: (session.user as any)?.displayName, rolesCount: (session.user as any)?.roles?.length });
      return session;
    },
  },
});
