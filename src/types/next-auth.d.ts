import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      displayName?: string | null;
      image?: string | null;
      logoUrl?: string | null;
      appName?: string | null;
      supportEmail?: string | null;
      tenantId: string;
      roles: string[];
      isContractor: boolean;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    tenantId?: string;
    roles?: string[];
    isContractor?: boolean;
    displayName?: string;
    logoUrl?: string;
    appName?: string;
    supportEmail?: string;
  }
}
