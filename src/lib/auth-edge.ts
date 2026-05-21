/**
 * Edge-compatible auth config for the proxy (Next.js 16).
 * Uses JWT validation only — no database queries, no Prisma.
 */
import NextAuth from "next-auth";

export const { auth } = NextAuth({
  session: { strategy: "jwt" },
  secret: process.env.AUTH_SECRET,
  providers: [], // credentials provider runs server-side only
  callbacks: {
    async jwt({ token }) {
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
