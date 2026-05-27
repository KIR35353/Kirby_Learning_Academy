import React from "react";
import { ImageResponse } from "next/og";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { headers } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

async function resolveTenantFaviconUrl(): Promise<string | null> {
  const session = await auth();
  const tenantId = (session?.user as Record<string, unknown>)?.tenantId as string | undefined;

  if (tenantId) {
    const bySession = await db.tenant.findUnique({
      where: { id: tenantId },
      select: { faviconUrl: true },
    });
    if (bySession?.faviconUrl) return bySession.faviconUrl;
  }

  const hostHeader = (await headers()).get("host")?.toLowerCase() ?? "";
  const host = hostHeader.split(":")[0];
  const [subdomain] = host.split(".");

  if (host) {
    const byHost = await db.tenant.findFirst({
      where: {
        OR: [{ slug: subdomain || undefined }, { domain: host }],
      },
      select: { faviconUrl: true },
    });
    if (byHost?.faviconUrl) return byHost.faviconUrl;
  }

  return null;
}

export default async function favicon() {
  try {
    const faviconUrl = await resolveTenantFaviconUrl();

    if (faviconUrl) {
      try {
        const response = await fetch(faviconUrl, { cache: "no-store" });
        if (response.ok) {
          const buffer = await response.arrayBuffer();
          return new Response(buffer, {
            headers: {
              "Content-Type": response.headers.get("Content-Type") || "image/x-icon",
              "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
              Vary: "Host, Cookie",
            },
          });
        }
      } catch (error) {
        console.error("Failed to fetch tenant favicon:", error);
        // Fall through to default favicon
      }
    }
  } catch (error) {
    console.error("Error loading tenant favicon:", error);
    // Fall through to default favicon
  }

  // Default Kirby Learning Academy favicon
  return new ImageResponse(
    React.createElement(
      "div",
      {
        style: {
          fontSize: 88,
          background: "linear-gradient(135deg, #003366 0%, #004d99 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: "bold",
        },
      },
      "K",
    ),
    {
      width: 32,
      height: 32,
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
        Vary: "Host, Cookie",
      },
    }
  );
}
