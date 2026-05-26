import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav, PageShell, Footer } from "@/components/layout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { BookOpen, ShieldCheck, Award, TrendingUp, PlayCircle, CalendarDays, CheckCircle2, Clock } from "lucide-react";
import { StudentProgressChart } from "@/components/charts/student-progress-chart";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const displayName = session.user.name ?? session.user.email ?? "there";
  const appName = (session.user as { appName?: string | null }).appName ?? "Kirby Learning Academy";

  // Real enrollment stats
  const [enrollments, dueSoonCount, completedAll, certCount] = await Promise.all([
    db.enrollment.findMany({
      where: { userId: session.user.id, tenantId: session.user.tenantId },
      include: {
        course: { select: { title: true, category: true } },
      },
      orderBy: [{ dueDate: "asc" }, { updatedAt: "desc" }],
      take: 5,
    }),
    db.enrollment.count({
      where: {
        userId: session.user.id,
        tenantId: session.user.tenantId,
        status: { notIn: ["PASSED", "COMPLETED", "EXPIRED"] },
        dueDate: { lte: new Date(Date.now() + 7 * 86400000) },
      },
    }),
    db.enrollment.findMany({
      where: { userId: session.user.id, status: { in: ["PASSED", "COMPLETED"] }, completedAt: { not: null } },
      select: { completedAt: true },
      orderBy: { completedAt: "asc" },
    }),
    db.certificationRecord.count({ where: { userId: session.user.id, status: "VALID" } }),
  ]);

  const stats = {
    total: enrollments.length,
    inProgress: enrollments.filter((e) => e.status === "IN_PROGRESS").length,
    passed: enrollments.filter((e) => e.status === "PASSED" || e.status === "COMPLETED").length,
    notStarted: enrollments.filter((e) => e.status === "NOT_STARTED").length,
  };

  // Build 6-month completion history from all completions
  const historyMap: Record<string, number> = {};
  for (const e of completedAll) {
    if (e.completedAt) {
      const key = e.completedAt.toISOString().slice(0, 7);
      historyMap[key] = (historyMap[key] ?? 0) + 1;
    }
  }
  const completionHistory = Object.entries(historyMap)
    .map(([month, count]) => ({ month, count }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-6);

  const recentActive = enrollments
    .filter((e) => e.status === "IN_PROGRESS" || e.status === "NOT_STARTED")
    .slice(0, 4);

  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Dashboard" />

        <PageShell>
          {/* welcome banner */}
          <div className="mb-8 rounded-xl border border-white/10 bg-white/5 px-6 py-5">
            <p className="text-xs font-semibold uppercase tracking-widest text-[#cc3d00]">
              {appName}
            </p>
            <h2 className="mt-1 text-2xl font-bold text-white">
              Welcome back, {displayName}
            </h2>
            <p className="mt-1 text-sm text-white/60">
              {dueSoonCount > 0 ? (
                <>
                  You have{" "}
                  <span className="font-semibold text-[#cc3d00]">{dueSoonCount} course{dueSoonCount > 1 ? "s" : ""} due</span>{" "}
                  this week.
                </>
              ) : stats.inProgress > 0 ? (
                <>
                  You have{" "}
                  <span className="font-semibold text-amber-400">{stats.inProgress} course{stats.inProgress > 1 ? "s" : ""} in progress</span>.
                </>
              ) : (
                "Your learning is up to date."
              )}
            </p>
          </div>

          {/* stat cards */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard icon={BookOpen}    label="Enrolled"    value={String(stats.total)}      sub={`${stats.inProgress} in progress`}     accent="blue" />
            <StatCard icon={Clock}       label="Not Started" value={String(stats.notStarted)} sub="ready to begin"                        accent="orange" />
            <StatCard icon={CheckCircle2} label="Passed"     value={String(stats.passed)}     sub="completed courses"                     accent="green" />
            <StatCard icon={TrendingUp}  label="Due Soon"    value={String(dueSoonCount)}     sub="in the next 7 days"                    accent={dueSoonCount > 0 ? "orange" : "blue"} />
          </div>

          {/* progress chart + certs row */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="md:col-span-2 rounded-xl border border-white/10 bg-white/5 p-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/50 mb-3">Completion History</p>
              <StudentProgressChart data={completionHistory} />
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4 flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-white/50">Quick Links</p>
              <Link href="/compliance" className="flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-3 transition-colors">
                <Award className="h-5 w-5 text-yellow-400 shrink-0" />
                <div>
                  <p className="text-sm text-white">{certCount} Valid Cert{certCount !== 1 ? "s" : ""}</p>
                  <p className="text-xs text-white/40">View my compliance</p>
                </div>
              </Link>
              <Link href="/my-skills" className="flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-3 transition-colors">
                <TrendingUp className="h-5 w-5 text-blue-400 shrink-0" />
                <div>
                  <p className="text-sm text-white">Skills Matrix</p>
                  <p className="text-xs text-white/40">View my competencies</p>
                </div>
              </Link>
              <Link href="/catalog" className="flex items-center gap-3 rounded-lg bg-white/5 hover:bg-white/10 p-3 transition-colors">
                <BookOpen className="h-5 w-5 text-green-400 shrink-0" />
                <div>
                  <p className="text-sm text-white">Course Catalog</p>
                  <p className="text-xs text-white/40">Browse available courses</p>
                </div>
              </Link>
            </div>
          </div>

          {/* active courses */}
          {recentActive.length > 0 && (
            <div className="mb-8">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-white/50">
                  Continue Learning
                </h3>
                <Link href="/my-courses" className="text-xs text-white/40 hover:text-white transition-colors">
                  View all →
                </Link>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {recentActive.map((e) => (
                  <Link
                    key={e.id}
                    href={`/courses/${e.id}/launch`}
                    className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 p-4 hover:border-white/20 hover:bg-white/10 transition-colors group"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#cc3d00]/20">
                      <PlayCircle className="h-5 w-5 text-[#cc3d00] group-hover:scale-110 transition-transform" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{e.course.title}</p>
                      <p className="text-xs text-white/40">
                        {e.status === "IN_PROGRESS" ? "In Progress" : "Not Started"}
                        {e.dueDate && ` · Due ${new Date(e.dueDate).toLocaleDateString()}`}
                      </p>
                    </div>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* empty state */}
          {stats.total === 0 && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
              <BookOpen className="h-12 w-12 text-white/20" />
              <div>
                <p className="font-medium text-white">No courses yet</p>
                <p className="mt-1 text-sm text-white/50">Browse the catalog to find and enroll in courses.</p>
              </div>
              <Link href="/catalog">
                <Button className="bg-[#cc3d00] text-white hover:bg-[#b33400]">Browse Catalog</Button>
              </Link>
            </div>
          )}

          {stats.total > 0 && recentActive.length === 0 && (
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 px-6 py-5 text-center">
              <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
              <p className="font-medium text-emerald-300">All caught up!</p>
              <p className="mt-1 text-sm text-white/50">All your assigned courses are complete.</p>
            </div>
          )}
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
    blue: "bg-blue-500/10 text-blue-400",
    orange: "bg-[#cc3d00]/10 text-[#cc3d00]",
    green: "bg-emerald-500/10 text-emerald-400",
  }[accent];

  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-white/50">{label}</p>
        <span className={`rounded-lg p-1.5 ${iconClass}`}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-3xl font-bold text-white">{value}</p>
      <p className="mt-0.5 text-xs text-white/40">{sub}</p>
    </div>
  );
}
