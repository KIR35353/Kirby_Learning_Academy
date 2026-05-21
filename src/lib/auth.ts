import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import MicrosoftEntraId from "next-auth/providers/microsoft-entra-id";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";
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

    const user = await db.user.findUnique({
      where: { email: credentials.email as string },
      include: {
        roles: { include: { role: true } },
      },
    });

    if (!user || !user.passwordHash) return null;
    if (!user.isActive) return null;

    const passwordMatch = await bcrypt.compare(
      credentials.password as string,
      user.passwordHash,
    );
    if (!passwordMatch) return null;

    return {
      id: user.id,
      email: user.email,
      name: user.name ?? user.email,
      image: user.avatarUrl,
      tenantId: user.tenantId,
      isContractor: user.isContractor,
      roles: user.roles.map((ur: { role: { name: string } }) => ur.role.name),
    };
  },
});

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

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: buildProviders(),
  callbacks: {
    async jwt({ token, user, account }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as { tenantId?: string }).tenantId;
        token.isContractor = (user as { isContractor?: boolean }).isContractor;
        token.roles = (user as { roles?: string[] }).roles ?? [];
      }
      // On SSO sign-in the user record exists in the DB via PrismaAdapter —
      // load tenantId + roles from DB so they land in the JWT.
      if (account?.provider === "microsoft-entra-id" && token.sub) {
        const dbUser = await db.user.findUnique({
          where: { id: token.sub },
          include: { roles: { include: { role: true } } },
        });
        if (dbUser) {
          token.tenantId = dbUser.tenantId;
          token.isContractor = dbUser.isContractor;
          token.roles = dbUser.roles.map(
            (ur: { role: { name: string } }) => ur.role.name,
          );
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token && session.user) {
        session.user.id = token.id as string;
        const u = session.user as unknown as Record<string, unknown>;
        u.tenantId = token.tenantId;
        u.isContractor = token.isContractor;
        u.roles = token.roles;
      }
      return session;
    },
  },
});
