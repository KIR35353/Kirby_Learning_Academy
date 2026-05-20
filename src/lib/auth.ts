import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { PrismaAdapter } from "@auth/prisma-adapter";
import bcrypt from "bcryptjs";
import { db } from "@/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: PrismaAdapter(db),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  providers: [
    Credentials({
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
    }),
    // SAML / SSO providers added here in future phases
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.tenantId = (user as { tenantId?: string }).tenantId;
        token.isContractor = (user as { isContractor?: boolean }).isContractor;
        token.roles = (user as { roles?: string[] }).roles ?? [];
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
