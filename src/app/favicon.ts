import { ImageResponse } from "next/og";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";
export const revalidate = 3600; // Revalidate every hour

export default async function favicon() {
  try {
    // Get tenant info from session
    const session = await auth();
    const tenantId = (session?.user as Record<string, unknown>)?.tenantId as string | undefined;

    if (tenantId) {
      const tenant = await db.tenant.findUnique({
        where: { id: tenantId },
        select: { faviconUrl: true, updatedAt: true },
      });

      // If tenant has a custom favicon URL, try to fetch and return it
      if (tenant?.faviconUrl) {
        try {
          const response = await fetch(tenant.faviconUrl, { cache: "no-store" });
          if (response.ok) {
            const buffer = await response.arrayBuffer();
            return new Response(buffer, {
              headers: { "Content-Type": response.headers.get("Content-Type") || "image/x-icon" },
            });
          }
        } catch (error) {
          console.error("Failed to fetch tenant favicon:", error);
          // Fall through to default favicon
        }
      }
    }
  } catch (error) {
    console.error("Error loading tenant favicon:", error);
    // Fall through to default favicon
  }

  // Default Kirby Learning Academy favicon
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 88,
          background: "linear-gradient(135deg, #003366 0%, #004d99 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: "bold",
        }}
      >
        K
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  );
}
