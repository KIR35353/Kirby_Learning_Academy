import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav, PageShell, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, ShieldCheck, Award, TrendingUp } from "lucide-react";

export default async function HomePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const displayName =
    (session.user as Record<string, unknown>)?.name as string | undefined ??
    session.user?.email ??
    "there";

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Dashboard" notificationCount={3} />

        <PageShell>
          {/* welcome banner */}
          <div className="mb-8 rounded-lg border border-border bg-white px-6 py-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-widest text-k-orange">
              Kirby Learning Academy
            </p>
            <h2 className="mt-1 text-2xl font-bold text-k-navy">
              Welcome back, {displayName}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              You have{" "}
              <span className="font-semibold text-k-orange">2 courses due</span>{" "}
              this week and{" "}
              <span className="font-semibold text-k-orange">
                1 certification expiring
              </span>{" "}
              in 30 days.
            </p>
          </div>

          {/* stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              icon={BookOpen}
              label="Courses Enrolled"
              value="6"
              sub="2 in progress"
              accent="blue"
            />
            <StatCard
              icon={Award}
              label="Certifications"
              value="4"
              sub="1 expiring soon"
              accent="orange"
            />
            <StatCard
              icon={ShieldCheck}
              label="Compliance Score"
              value="92%"
              sub="Above target"
              accent="green"
            />
            <StatCard
              icon={TrendingUp}
              label="Completions (YTD)"
              value="11"
              sub="+3 this month"
              accent="blue"
            />
          </div>

          {/* placeholder */}
          <div className="mt-6 rounded-lg border border-dashed border-border bg-muted/30 p-12 text-center text-sm text-muted-foreground">
            Dashboard widgets — coming in Phase 10
          </div>
        </PageShell>

        <Footer />
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────
type StatCardProps = {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub: string;
  accent: "blue" | "orange" | "green";
};

function StatCard({ icon: Icon, label, value, sub, accent }: StatCardProps) {
  const iconClass = {
    blue: "bg-k-blue/10 text-k-blue",
    orange: "bg-k-orange/10 text-k-orange",
    green: "bg-emerald-500/10 text-emerald-600",
  }[accent];

  return (
    <Card className="shadow-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {label}
        </CardTitle>
        <span className={`rounded-md p-1.5 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </CardHeader>
      <CardContent>
        <p className="text-2xl font-bold text-k-navy">{value}</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}
