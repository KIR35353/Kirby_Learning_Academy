import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { Sidebar, TopNav } from "@/components/layout";
import Link from "next/link";
import { Building, RefreshCw, Bell, ShieldCheck } from "lucide-react";

export const metadata = { title: "Settings — Admin" };

export default async function AdminSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const isAdmin = roles.includes("SUPER_ADMIN") || roles.includes("TENANT_ADMIN");
  if (!isAdmin) redirect("/unauthorized");

  const links = [
    {
      href: "/admin/tenants",
      icon: Building,
      title: "Tenant & Branding",
      description: "Configure branding, colours, logos, and tenant-level settings.",
    },
    {
      href: "/admin/hris",
      icon: RefreshCw,
      title: "HRIS Sync",
      description: "Manage HRIS integrations and sync user/org data from external systems.",
    },
    {
      href: "/admin/notifications",
      icon: Bell,
      title: "Notifications",
      description: "Send broadcast notifications and manage notification templates.",
    },
    {
      href: "/admin/compliance",
      icon: ShieldCheck,
      title: "Compliance",
      description: "Configure compliance rules, certification requirements, and recertification schedules.",
    },
  ];

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Settings" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-2xl space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-white">Settings</h2>
              <p className="mt-1 text-sm text-white/50">Manage your platform configuration.</p>
            </div>
            <div className="grid gap-4">
              {links.map(({ href, icon: Icon, title, description }) => (
                <Link
                  key={href}
                  href={href}
                  className="flex items-start gap-4 rounded-xl border border-white/10 bg-white/5 p-5 hover:bg-white/10 transition-colors"
                >
                  <div className="mt-0.5 rounded-lg bg-white/10 p-2">
                    <Icon className="h-5 w-5 text-white/70" />
                  </div>
                  <div>
                    <p className="font-medium text-white">{title}</p>
                    <p className="mt-0.5 text-sm text-white/50">{description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
