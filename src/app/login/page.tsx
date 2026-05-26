import { LoginClient } from "./_components/login-client";
import type { AuthMode } from "@/lib/auth";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { db } from "@/lib/db";

type LoginBranding = {
  appName: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  loginBannerUrl: string | null;
  updatedAt: Date;
};

async function getLoginBranding(): Promise<LoginBranding | null> {
  const hostHeader = (await headers()).get("host")?.toLowerCase() ?? "";
  const host = hostHeader.split(":")[0];
  const [subdomain] = host.split(".");

  const byHost = host
    ? await db.tenant.findFirst({
        where: {
          OR: [
            { slug: subdomain || undefined },
            { domain: host },
          ],
        },
        select: {
          appName: true,
          logoUrl: true,
          faviconUrl: true,
          loginBannerUrl: true,
          updatedAt: true,
        },
      })
    : null;
  if (byHost) return byHost;

  const tenantCount = await db.tenant.count();
  if (tenantCount !== 1) return null;

  return db.tenant.findFirst({
    orderBy: { createdAt: "asc" },
    select: {
      appName: true,
      logoUrl: true,
      faviconUrl: true,
      loginBannerUrl: true,
      updatedAt: true,
    },
  });
}

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getLoginBranding();
  const appName = branding?.appName ?? "Kirby Learning Academy";
  const iconUrl = branding?.faviconUrl
    ? `${branding.faviconUrl}${branding.faviconUrl.includes("?") ? "&" : "?"}v=${branding.updatedAt.getTime()}`
    : "/favicon.ico";

  return {
    title: `Sign In | ${appName}`,
    icons: { icon: iconUrl },
  };
}

export default async function LoginPage() {
  const authMode: AuthMode =
    (process.env.AUTH_MODE as AuthMode | undefined) ?? "credentials";
  const branding = await getLoginBranding();

  return (
    <LoginClient
      authMode={authMode}
      branding={{
        logoUrl: branding?.logoUrl ?? null,
        loginBannerUrl: branding?.loginBannerUrl ?? null,
        appName: branding?.appName ?? null,
      }}
    />
  );
}

