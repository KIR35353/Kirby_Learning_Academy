"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import {
  BookOpen,
  LayoutDashboard,
  ClipboardList,
  ShieldCheck,
  BarChart3,
  Users,
  Settings,
  GraduationCap,
  Award,
  Network,
  RefreshCw,
  Building,
  TrendingUp,
  Bell,
  Trophy,
  MessageSquare,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";

// ── Nav item definitions ───────────────────────────────────────────────────
type NavItem = {
  label: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
};

const studentNav: NavItem[] = [
  { label: "Dashboard",     href: "/",             icon: LayoutDashboard },
  { label: "My Courses",    href: "/my-courses",   icon: BookOpen },
  { label: "My Learning",   href: "/my-learning",  icon: GraduationCap },
  { label: "My Skills",     href: "/my-skills",    icon: TrendingUp },
  { label: "Assessments",   href: "/assessments",  icon: ClipboardList },
  { label: "Course Catalog",href: "/catalog",      icon: BookOpen },
  { label: "Certifications",href: "/compliance",   icon: Award },
  { label: "Achievements",  href: "/achievements", icon: Award },
  { label: "Leaderboard",   href: "/leaderboard",  icon: Trophy },
  { label: "Forums",        href: "/forums",       icon: MessageSquare },
];

const adminNav: NavItem[] = [
  { label: "Users",           href: "/admin/users",           icon: Users },
  { label: "Org Structure",   href: "/admin/org",             icon: Network },
  { label: "HRIS Sync",       href: "/admin/hris",            icon: RefreshCw },
  { label: "Tenants",         href: "/admin/tenants",         icon: Building },
  { label: "Courses",         href: "/admin/courses",         icon: BookOpen },
  { label: "Learning Paths",  href: "/admin/learning-paths",  icon: GraduationCap },
  { label: "Curricula",       href: "/admin/curricula",       icon: ClipboardList },
  { label: "Assessments",     href: "/admin/assessments",     icon: ClipboardList },
  { label: "Skills Library",  href: "/admin/skills",          icon: TrendingUp },
  { label: "Skills Matrix",   href: "/admin/skills/matrix",   icon: BarChart3 },
  { label: "Certifications",  href: "/admin/certifications",  icon: Award },
  { label: "Compliance",      href: "/admin/compliance",      icon: ShieldCheck },
  { label: "Reports",         href: "/admin/reports",         icon: BarChart3 },
  { label: "Badges",          href: "/admin/badges",          icon: Award },
  { label: "Notifications",   href: "/admin/notifications",   icon: Bell },
  { label: "Settings",        href: "/admin/settings",        icon: Settings },
];

const managerNav: NavItem[] = [
  { label: "Team Dashboard",  href: "/manager/dashboard",     icon: BarChart3 },
];

const ADMIN_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN"]);
const MANAGER_ROLES = new Set(["SUPER_ADMIN", "TENANT_ADMIN", "MANAGER"]);

// ── Component ──────────────────────────────────────────────────────────────
export function Sidebar() {
  const pathname = usePathname();
  const { data: session, status, update } = useSession();
  const sessionRefreshAttempted = useRef(false);
  const userRoles: string[] = (session?.user as { roles?: string[] } | undefined)?.roles ?? [];
  const isAdmin   = userRoles.some((r) => ADMIN_ROLES.has(r));
  const isManager = userRoles.some((r) => MANAGER_ROLES.has(r));

  useEffect(() => {
    if (status === "loading" || sessionRefreshAttempted.current) return;

    const user = session?.user as
      | {
          roles?: string[];
          displayName?: string | null;
          name?: string | null;
          email?: string | null;
        }
      | undefined;

    // Server-action redirects can leave the client SessionProvider in an
    // unauthenticated cache state until a manual reload. Trigger one refresh.
    if (status === "unauthenticated") {
      sessionRefreshAttempted.current = true;
      void update();
      return;
    }

    const needsRefresh =
      !Array.isArray(user?.roles) ||
      user.roles.length === 0 ||
      (!user?.displayName && !user?.email && (!user?.name || user.name === "User"));

    if (!needsRefresh) return;

    sessionRefreshAttempted.current = true;
    void update();
  }, [session, status, update]);

  return (
    <aside className="flex h-full w-60 flex-col bg-sidebar text-sidebar-foreground">
      {/* logo area */}
      <div className="flex shrink-0 items-center justify-center border-b border-sidebar-border px-4 py-5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/kirby_learning_academy_logo.png"
          alt="Kirby Learning Academy"
          className="w-full max-w-[200px] h-auto object-contain"
        />
      </div>

      {/* nav links */}
      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
        <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
          Learning
        </p>
        {studentNav.map((item) => (
          <NavLink key={item.href} item={item} active={pathname === item.href} />
        ))}

        {isAdmin && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              Administration
            </p>
            {adminNav.map((item) => (
              <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}

        {isManager && (
          <>
            <Separator className="my-3 bg-sidebar-border" />
            <p className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/50">
              Manager
            </p>
            {managerNav.map((item) => (
              <NavLink key={item.href} item={item} active={pathname.startsWith(item.href)} />
            ))}
          </>
        )}
      </nav>

      {/* bottom brand strip */}
      <div className="shrink-0 border-t border-sidebar-border px-5 py-3">
        <p className="text-[10px] text-sidebar-foreground/40">
          © {new Date().getFullYear()} Kirby Corporation
        </p>
      </div>
    </aside>
  );
}

// ── NavLink sub-component ─────────────────────────────────────────────────
function NavLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      className={cn(
        "group flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-sidebar-accent text-sidebar-accent-foreground"
          : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span className="flex-1 truncate">{item.label}</span>
      {item.badge && (
        <Badge className="ml-auto h-5 min-w-5 justify-center bg-k-orange text-[10px] text-white">
          {item.badge}
        </Badge>
      )}
    </Link>
  );
}
