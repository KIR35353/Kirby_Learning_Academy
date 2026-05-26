import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { cache } from "react";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// ── Per-request cached branding lookup ───────────────────────────────────────
// React cache() deduplicates across generateMetadata + the layout component
// within the same request, so only one DB query fires per page load.
const getTenantBranding = cache(async () => {
  const session = await auth();
  const tenantId = (session?.user as Record<string, unknown>)?.tenantId as string | undefined;
  if (!tenantId) return null;
  return db.tenant.findUnique({
    where: { id: tenantId },
    select: {
      appName: true,
      faviconUrl: true,
      primaryColor: true,
      primaryForegroundColor: true,
      sidebarColor: true,
      accentColor: true,
    },
  });
});

// ── Dynamic metadata (title + favicon) ───────────────────────────────────────
export async function generateMetadata(): Promise<Metadata> {
  const branding = await getTenantBranding();
  const name = branding?.appName ?? "Kirby Learning Academy";
  return {
    title: { default: name, template: `%s | ${name}` },
    description:
      "Enterprise learning management system — compliance, certification, and workforce development.",
    icons: branding?.faviconUrl
      ? { icon: branding.faviconUrl }
      : { icon: "/favicon.ico" },
  };
}

// ── CSS variable injection ────────────────────────────────────────────────────
// Returns CSS custom properties as an object that can be spread onto the <html>
// style prop. CSS custom properties cascade to all descendants.
function buildCssVars(b: {
  primaryColor: string | null;
  primaryForegroundColor: string | null;
  sidebarColor: string | null;
  accentColor: string | null;
}): React.CSSProperties {
  const vars: Record<string, string> = {};
  if (b.primaryColor) {
    vars["--primary"] = b.primaryColor;
    vars["--sidebar-primary"] = b.primaryColor;
    vars["--chart-1"] = b.primaryColor;
  }
  if (b.primaryForegroundColor) {
    vars["--primary-foreground"] = b.primaryForegroundColor;
    vars["--sidebar-primary-foreground"] = b.primaryForegroundColor;
  }
  if (b.sidebarColor) {
    vars["--sidebar"] = b.sidebarColor;
  }
  if (b.accentColor) {
    vars["--ring"] = b.accentColor;
  }
  return vars as React.CSSProperties;
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const branding = await getTenantBranding();
  const cssVars = branding ? buildCssVars(branding) : {};

  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`} style={cssVars}>
      <body className="min-h-full bg-background text-foreground">
        <SessionProvider>
          <TooltipProvider delay={300}>{children}</TooltipProvider>
        </SessionProvider>
      </body>
    </html>
  );
}

