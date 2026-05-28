import { auth } from "@/lib/auth-edge";
import { NextResponse } from "next/server";
import type { NextAuthRequest } from "next-auth";

const LAST_TENANT_COOKIE = "kla_last_tenant_id";

// Routes that don't require authentication
const publicRoutes = [
  "/login",
  "/forgot-password",
  "/reset-password",
  "/api/auth",
  "/api/certificates/verify",  // public cert verification
  "/api/health",               // load-balancer health check
];

// Routes that require specific roles
const adminRoutes = ["/admin"];
const managerRoutes = ["/reports", "/team"];

function isPublicRoute(pathname: string) {
  return publicRoutes.some((route) => pathname.startsWith(route));
}

function withLastTenantCookie(req: NextAuthRequest, res: NextResponse): NextResponse {
  const user = req.auth?.user as Record<string, unknown> | undefined;
  const tenantId = user?.tenantId;

  if (typeof tenantId === "string" && tenantId) {
    res.cookies.set(LAST_TENANT_COOKIE, tenantId, {
      path: "/",
      sameSite: "lax",
      secure: req.nextUrl.protocol === "https:",
      httpOnly: false,
      maxAge: 60 * 60 * 24 * 365,
    });
  }

  return res;
}

export default auth((req: NextAuthRequest) => {
  const { pathname } = req.nextUrl;

  // Allow public routes and static assets through
  if (
    isPublicRoute(pathname) ||
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.match(/\.(png|jpg|jpeg|svg|ico|webp)$/)
  ) {
    return withLastTenantCookie(req, NextResponse.next());
  }

  // Not authenticated → redirect to login
  if (!req.auth) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const user = req.auth?.user as Record<string, unknown> | undefined;
  const roles: string[] = (user?.roles as string[]) ?? [];

  // Admin routes require SUPER_ADMIN or TENANT_ADMIN (plus INSTRUCTOR for course pages)
  if (adminRoutes.some((r) => pathname.startsWith(r))) {
    const instructorAllowed = pathname.startsWith("/admin/courses");
    const allowed =
      roles.includes("SUPER_ADMIN") ||
      roles.includes("TENANT_ADMIN") ||
      (instructorAllowed && roles.includes("INSTRUCTOR"));
    if (!allowed) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  // Manager routes require MANAGER or admin roles
  if (managerRoutes.some((r) => pathname.startsWith(r))) {
    const managerRoles = [
      "SUPER_ADMIN",
      "TENANT_ADMIN",
      "MANAGER",
    ];
    if (!roles.some((r) => managerRoles.includes(r))) {
      return NextResponse.redirect(new URL("/unauthorized", req.url));
    }
  }

  return withLastTenantCookie(req, NextResponse.next());
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
