"use client";

import { useEffect, useState, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  RefreshCw,
  Users,
  BookOpen,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Trophy,
  XCircle,
} from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface Dept { id: string; name: string }
interface CourseSummary { id: string; title: string }

interface OverviewData {
  totalUsers: number;
  enrollments: { total: number; byStatus: Record<string, number>; completionRate: number; overdue: number };
  certifications: { byStatus: Record<string, number> };
  recentCompletions: { id: string; user: { name: string | null }; course: { title: string }; completedAt: string | null }[];
  topCourses: { id: string; title: string; enrollmentCount: number }[];
  completionsByMonth: { month: string; count: number }[];
}

interface CourseEffRow {
  id: string; title: string; status: string;
  totalEnrollments: number; completionRate: number; passRate: number; avgScore: number | null;
  avgTimeMinutes: number | null;
}

interface UserOption {
  id: string;
  name: string | null;
  email: string;
  department: string | null;
  jobTitle: string | null;
}

interface Tenant {
  id: string;
  name: string;
}

interface UserSummary {
  user: {
    id: string;
    name: string | null;
    email: string;
    department: string | null;
    jobTitle: string | null;
    joinedAt: string;
  };
  logins: {
    successful: number;
    failed: number;
    lastLoginAt: string | null;
  };
  courses: {
    total: number;
    completed: number;
    inProgress: number;
    notStarted: number;
    failed: number;
    overdue: number;
    completionRate: number;
    completionsInWindow: number;
  };
  assessments: {
    totalAttempts: number;
    passed: number;
    failed: number;
    inProgress: number;
    passRate: number;
    avgScore: number | null;
  };
  ranking: {
    rank: number;
    totalUsers: number;
    percentile: number;
  };
  recentActivity: Array<{
    type: "LOGIN" | "COURSE" | "ASSESSMENT";
    label: string;
    timestamp: string;
  }>;
}

const PIE_COLORS = ["#22c55e", "#eab308", "#ef4444", "#94a3b8", "#f97316"];

const STATUS_COLORS: Record<string, string> = {
  PASSED: "#22c55e", COMPLETED: "#22c55e",
  IN_PROGRESS: "#3b82f6",
  NOT_STARTED: "#64748b",
  FAILED: "#ef4444",
};

const FILTER_CONTROL_CLASS = "rounded-lg border border-white/20 bg-white text-slate-900 px-3 py-1.5 text-sm";
const FILTER_OPTION_CLASS = "bg-white text-slate-900";

// ── Sub-components ─────────────────────────────────────────────────────────

function StatCard({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string | number; sub?: string }) {
  return (
    <Card className="bg-white/5 border-white/10 p-5 flex items-start gap-4">
      <div className="shrink-0 mt-0.5">{icon}</div>
      <div>
        <p className="text-xs text-white/50">{label}</p>
        <p className="text-2xl font-semibold text-white">{value}</p>
        {sub && <p className="text-xs text-white/30 mt-0.5">{sub}</p>}
      </div>
    </Card>
  );
}

// ── Main component ──────────────────────────────────────────────────────────

export function AdminReportsClient({
  departments, courses, tenants = [], isSuperAdmin = false, defaultTenantId = "",
}: { 
  departments: Dept[]; 
  courses: CourseSummary[];
  tenants?: Tenant[];
  isSuperAdmin?: boolean;
  defaultTenantId?: string;
}) {
  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [effectiveness, setEffectiveness] = useState<CourseEffRow[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [userSummary, setUserSummary] = useState<UserSummary | null>(null);
  const [loadingOverview, setLoadingOverview] = useState(true);
  const [loadingEff, setLoadingEff] = useState(true);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingUserSummary, setLoadingUserSummary] = useState(false);
  const [deptId, setDeptId] = useState("");
  const [courseId, setCourseId] = useState("");
  const [selectedUserId, setSelectedUserId] = useState("");
  const [selectedTenantId, setSelectedTenantId] = useState(defaultTenantId);
  const [activeTab, setActiveTab] = useState<"overview" | "completions" | "effectiveness" | "userPerformance">("overview");

  // Completion report filters
  const [filterStatus, setFilterStatus] = useState("");
  const [filterStart, setFilterStart] = useState("");
  const [filterEnd, setFilterEnd] = useState("");

  const loadOverview = useCallback(async () => {
    setLoadingOverview(true);
    const params = deptId ? `?departmentId=${deptId}` : "";
    const res = await fetch(`/api/reports/overview${params}`);
    if (res.ok) setOverview(await res.json());
    setLoadingOverview(false);
  }, [deptId]);

  const loadEffectiveness = useCallback(async () => {
    setLoadingEff(true);
    const params = courseId ? `?courseId=${courseId}` : "";
    const res = await fetch(`/api/reports/course-effectiveness${params}`);
    if (res.ok) setEffectiveness(await res.json());
    setLoadingEff(false);
  }, [courseId]);

  const loadUsers = useCallback(async () => {
    setLoadingUsers(true);
    const params = new URLSearchParams();
    if (deptId) params.set("departmentId", deptId);
    if (isSuperAdmin && selectedTenantId) params.set("tenantId", selectedTenantId);
    const qs = params.toString();
    const res = await fetch(`/api/reports/users${qs ? `?${qs}` : ""}`);
    if (res.ok) {
      const data: UserOption[] = await res.json();
      setUsers(data);
      if (data.length === 0) {
        setSelectedUserId("");
        setUserSummary(null);
      } else if (!data.some((u) => u.id === selectedUserId)) {
        setSelectedUserId(data[0].id);
      }
    }
    setLoadingUsers(false);
  }, [deptId, selectedTenantId, isSuperAdmin, selectedUserId]);

  const loadUserSummary = useCallback(async () => {
    if (!selectedUserId) {
      setUserSummary(null);
      return;
    }
    setLoadingUserSummary(true);
    const params = new URLSearchParams();
    if (filterStart) params.set("startDate", filterStart);
    if (filterEnd) params.set("endDate", filterEnd);
    if (isSuperAdmin && selectedTenantId) params.set("tenantId", selectedTenantId);
    const qs = params.toString();
    const res = await fetch(`/api/reports/users/${selectedUserId}/summary${qs ? `?${qs}` : ""}`);
    if (res.ok) setUserSummary(await res.json());
    setLoadingUserSummary(false);
  }, [selectedUserId, filterStart, filterEnd, selectedTenantId, isSuperAdmin]);

  useEffect(() => { if (activeTab === "overview") loadOverview(); }, [activeTab, loadOverview]);
  useEffect(() => { if (activeTab === "effectiveness") loadEffectiveness(); }, [activeTab, loadEffectiveness]);
  useEffect(() => {
    if (activeTab === "userPerformance") loadUsers();
  }, [activeTab, loadUsers]);
  useEffect(() => {
    if (activeTab === "userPerformance" && selectedUserId) loadUserSummary();
  }, [activeTab, selectedUserId, filterStart, filterEnd, loadUserSummary]);

  function exportCompletions() {
    const p = new URLSearchParams({ export: "csv" });
    if (deptId) p.set("departmentId", deptId);
    if (courseId) p.set("courseId", courseId);
    if (filterStatus) p.set("status", filterStatus);
    if (filterStart) p.set("startDate", filterStart);
    if (filterEnd) p.set("endDate", filterEnd);
    window.open(`/api/reports/completions?${p.toString()}`, "_blank");
  }

  function exportUserReport() {
    if (!selectedUserId) return;
    const p = new URLSearchParams();
    if (filterStart) p.set("startDate", filterStart);
    if (filterEnd) p.set("endDate", filterEnd);
    if (isSuperAdmin && selectedTenantId) p.set("tenantId", selectedTenantId);
    window.open(`/api/reports/users/${selectedUserId}/export?${p.toString()}`, "_blank");
  }

  const tabs: { key: typeof activeTab; label: string }[] = [
    { key: "overview", label: "Overview" },
    { key: "completions", label: "Completions Report" },
    { key: "effectiveness", label: "Course Effectiveness" },
    { key: "userPerformance", label: "User Performance" },
  ];

  const certPieData = overview ? Object.entries(overview.certifications.byStatus).map(([name, value]) => ({ name, value })) : [];
  const enrollPieData = overview ? Object.entries(overview.enrollments.byStatus).map(([name, value]) => ({ name, value })) : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Reports & Analytics</h2>
          <p className="text-sm text-white/50">Org-wide training and compliance metrics</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {isSuperAdmin && (
            <select value={selectedTenantId} onChange={(e) => setSelectedTenantId(e.target.value)}
              className={FILTER_CONTROL_CLASS}>
              <option className={FILTER_OPTION_CLASS} value="">Select tenant...</option>
              {tenants.map((t) => <option className={FILTER_OPTION_CLASS} key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          )}
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
            className={FILTER_CONTROL_CLASS}>
            <option className={FILTER_OPTION_CLASS} value="">All departments</option>
            {departments.map((d) => <option className={FILTER_OPTION_CLASS} key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button
            onClick={activeTab === "effectiveness" ? loadEffectiveness : activeTab === "userPerformance" ? loadUserSummary : loadOverview}
            variant="outline"
            className="border-white/10 text-white/60 hover:bg-white/10 h-8 px-3"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button onClick={exportCompletions} className="bg-[#cc3d00] text-white hover:bg-[#b33400] h-8 px-3">
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-white/10">
        {tabs.map((t) => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`px-4 py-2 text-sm transition-colors ${activeTab === t.key ? "border-b-2 border-[#cc3d00] text-white" : "text-white/40 hover:text-white/70"}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── OVERVIEW TAB ─────────────────────────────────────────────────── */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {loadingOverview ? (
              Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />)
            ) : overview ? (
              <>
                <StatCard icon={<Users className="h-5 w-5 text-blue-400" />} label="Active Employees" value={overview.totalUsers} />
                <StatCard icon={<BookOpen className="h-5 w-5 text-purple-400" />} label="Total Enrollments" value={overview.enrollments.total} />
                <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-400" />} label="Completion Rate" value={`${overview.enrollments.completionRate}%`} />
                <StatCard icon={<AlertTriangle className="h-5 w-5 text-red-400" />} label="Overdue Enrollments" value={overview.enrollments.overdue} sub="past due date" />
              </>
            ) : null}
          </div>

          {/* Charts row */}
          {!loadingOverview && overview && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Completions over time */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-medium text-white/70 mb-4">Completions — Last 6 Months</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart data={overview.completionsByMonth}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="month" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                    <Line type="monotone" dataKey="count" stroke="#cc3d00" strokeWidth={2} dot={{ fill: "#cc3d00" }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Enrollment status pie */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-medium text-white/70 mb-4">Enrollment Status Distribution</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={enrollPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }: { name?: string; percent?: number }) => `${(name ?? "").replace("_", " ")} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                      {enrollPieData.map((entry, i) => (
                        <Cell key={entry.name} fill={STATUS_COLORS[entry.name] ?? PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Top courses */}
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <h3 className="text-sm font-medium text-white/70 mb-4">Top Courses by Enrollment</h3>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={overview.topCourses} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis type="number" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} />
                    <YAxis type="category" dataKey="title" width={140} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                    <Bar dataKey="enrollmentCount" fill="#cc3d00" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Cert status pie */}
              {certPieData.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                  <h3 className="text-sm font-medium text-white/70 mb-4">Certification Status</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie data={certPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }: { name?: string; percent?: number }) => `${(name ?? "").replace("_", " ")} ${Math.round((percent ?? 0) * 100)}%`} labelLine={false}>
                        {certPieData.map((entry, i) => (
                          <Cell key={entry.name} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}

          {/* Recent completions */}
          {!loadingOverview && overview && overview.recentCompletions.length > 0 && (
            <div className="rounded-xl border border-white/10 bg-white/5">
              <h3 className="text-sm font-medium text-white/70 px-4 py-3 border-b border-white/10">Recent Completions (Last 30 Days)</h3>
              <div className="divide-y divide-white/5">
                {overview.recentCompletions.map((r) => (
                  <div key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-white/80 truncate">{r.user.name ?? "—"}</p>
                      <p className="text-white/40 text-xs truncate">{r.course.title}</p>
                    </div>
                    {r.completedAt && (
                      <span className="text-xs text-white/30 shrink-0">{new Date(r.completedAt).toLocaleDateString()}</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── COMPLETIONS REPORT TAB ────────────────────────────────────────── */}
      {activeTab === "completions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs text-white/50">Course</p>
              <select value={courseId} onChange={(e) => setCourseId(e.target.value)}
                className={FILTER_CONTROL_CLASS}>
                <option className={FILTER_OPTION_CLASS} value="">All courses</option>
                {courses.map((c) => <option className={FILTER_OPTION_CLASS} key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">Status</p>
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
                className={FILTER_CONTROL_CLASS}>
                <option className={FILTER_OPTION_CLASS} value="">All statuses</option>
                <option className={FILTER_OPTION_CLASS} value="PASSED">Passed</option>
                <option className={FILTER_OPTION_CLASS} value="FAILED">Failed</option>
                <option className={FILTER_OPTION_CLASS} value="IN_PROGRESS">In Progress</option>
                <option className={FILTER_OPTION_CLASS} value="NOT_STARTED">Not Started</option>
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">From</p>
              <input type="date" value={filterStart} onChange={(e) => setFilterStart(e.target.value)}
                className={FILTER_CONTROL_CLASS} />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">To</p>
              <input type="date" value={filterEnd} onChange={(e) => setFilterEnd(e.target.value)}
                className={FILTER_CONTROL_CLASS} />
            </div>
            <Button onClick={exportCompletions} className="bg-[#cc3d00] text-white hover:bg-[#b33400] h-8 px-3">
              <Download className="h-3.5 w-3.5 mr-1" /> Download CSV
            </Button>
          </div>
          <p className="text-sm text-white/40">Use the filters above and click Download CSV to export filtered completion data.</p>
        </div>
      )}

      {/* ── USER PERFORMANCE TAB ─────────────────────────────────────────── */}
      {activeTab === "userPerformance" && (
        <div className="space-y-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1 min-w-[260px]">
              <p className="text-xs text-white/50">User</p>
              <select
                value={selectedUserId}
                onChange={(e) => setSelectedUserId(e.target.value)}
                className={`w-full ${FILTER_CONTROL_CLASS}`}
              >
                {loadingUsers && <option className={FILTER_OPTION_CLASS} value="">Loading users...</option>}
                {!loadingUsers && users.length === 0 && <option className={FILTER_OPTION_CLASS} value="">No users found</option>}
                {!loadingUsers && users.map((u) => (
                  <option className={FILTER_OPTION_CLASS} key={u.id} value={u.id}>
                    {(u.name ?? "Unnamed user") + " · " + u.email}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">From</p>
              <input
                type="date"
                value={filterStart}
                onChange={(e) => setFilterStart(e.target.value)}
                className={FILTER_CONTROL_CLASS}
              />
            </div>
            <div className="space-y-1">
              <p className="text-xs text-white/50">To</p>
              <input
                type="date"
                value={filterEnd}
                onChange={(e) => setFilterEnd(e.target.value)}
                className={FILTER_CONTROL_CLASS}
              />
            </div>
            <Button onClick={loadUserSummary} variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 h-8 px-3">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Load
            </Button>
            <Button
              onClick={exportUserReport}
              disabled={!selectedUserId || !userSummary}
              className="bg-[#cc3d00] text-white hover:bg-[#b33400] h-8 px-3 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
            </Button>
          </div>

          {loadingUserSummary ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />)}
            </div>
          ) : userSummary ? (
            <>
              <div className="rounded-xl border border-white/10 bg-white/5 p-4">
                <p className="text-sm text-white/80">
                  {userSummary.user.name ?? "Unnamed user"} <span className="text-white/40">({userSummary.user.email})</span>
                </p>
                <p className="text-xs text-white/40 mt-1">
                  {userSummary.user.department ?? "No department"}
                  {userSummary.user.jobTitle ? ` · ${userSummary.user.jobTitle}` : ""}
                  {` · Joined ${new Date(userSummary.user.joinedAt).toLocaleDateString()}`}
                </p>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <StatCard icon={<Activity className="h-5 w-5 text-blue-400" />} label="Logins" value={`${userSummary.logins.successful} / ${userSummary.logins.failed}`} sub={`${userSummary.logins.failed > 0 ? `${userSummary.logins.failed} failed · ` : ""}${userSummary.logins.lastLoginAt ? `Last: ${new Date(userSummary.logins.lastLoginAt).toLocaleString()}` : "No login recorded"}`} />
                <StatCard icon={<CheckCircle2 className="h-5 w-5 text-green-400" />} label="Course Completions" value={userSummary.courses.completed} sub={`${userSummary.courses.completionRate}% completion rate`} />
                <StatCard icon={<BookOpen className="h-5 w-5 text-amber-400" />} label="In Progress" value={userSummary.courses.inProgress} sub={`${userSummary.courses.overdue} overdue`} />
                <StatCard icon={<XCircle className="h-5 w-5 text-red-400" />} label="Failures" value={userSummary.courses.failed + userSummary.assessments.failed} sub="Courses + assessments" />
                <StatCard icon={<Trophy className="h-5 w-5 text-yellow-400" />} label="Ranking" value={`#${userSummary.ranking.rank}/${userSummary.ranking.totalUsers}`} sub={`${userSummary.ranking.percentile}th percentile`} />
                <StatCard icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />} label="Assessment Pass Rate" value={`${userSummary.assessments.passRate}%`} sub={`${userSummary.assessments.totalAttempts} attempts`} />
                <StatCard icon={<AlertTriangle className="h-5 w-5 text-orange-400" />} label="Window Completions" value={userSummary.courses.completionsInWindow} sub="within selected date range" />
                <StatCard icon={<Users className="h-5 w-5 text-indigo-400" />} label="Total Assignments" value={userSummary.courses.total} sub={`${userSummary.courses.notStarted} not started`} />
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <h3 className="text-sm font-medium text-white/70 px-4 py-3 border-b border-white/10">Course Status Breakdown</h3>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      <tr><td className="px-4 py-2 text-white/60">Completed</td><td className="px-4 py-2 text-right text-white">{userSummary.courses.completed}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">In Progress</td><td className="px-4 py-2 text-right text-white">{userSummary.courses.inProgress}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Not Started</td><td className="px-4 py-2 text-right text-white">{userSummary.courses.notStarted}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Failed</td><td className="px-4 py-2 text-right text-white">{userSummary.courses.failed}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Overdue</td><td className="px-4 py-2 text-right text-white">{userSummary.courses.overdue}</td></tr>
                    </tbody>
                  </table>
                </div>

                <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                  <h3 className="text-sm font-medium text-white/70 px-4 py-3 border-b border-white/10">Assessment Summary</h3>
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-white/5">
                      <tr><td className="px-4 py-2 text-white/60">Total Attempts</td><td className="px-4 py-2 text-right text-white">{userSummary.assessments.totalAttempts}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Passed</td><td className="px-4 py-2 text-right text-white">{userSummary.assessments.passed}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Failed</td><td className="px-4 py-2 text-right text-white">{userSummary.assessments.failed}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">In Progress</td><td className="px-4 py-2 text-right text-white">{userSummary.assessments.inProgress}</td></tr>
                      <tr><td className="px-4 py-2 text-white/60">Average Score</td><td className="px-4 py-2 text-right text-white">{userSummary.assessments.avgScore !== null ? `${userSummary.assessments.avgScore}%` : "—"}</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <h3 className="text-sm font-medium text-white/70 px-4 py-3 border-b border-white/10">Recent Activity</h3>
                <div className="divide-y divide-white/5">
                  {userSummary.recentActivity.length === 0 && (
                    <p className="px-4 py-6 text-sm text-white/40">No recent activity in selected date range.</p>
                  )}
                  {userSummary.recentActivity.map((item, idx) => (
                    <div key={`${item.type}-${item.timestamp}-${idx}`} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div>
                        <p className="text-sm text-white/80">{item.label}</p>
                        <p className="text-xs text-white/40">{item.type}</p>
                      </div>
                      <span className="text-xs text-white/40 shrink-0">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-white/40">Select a user to load the report.</p>
          )}
        </div>
      )}

      {/* ── COURSE EFFECTIVENESS TAB ─────────────────────────────────────── */}
      {activeTab === "effectiveness" && (
        <div className="space-y-4">
          <div className="flex gap-3 items-end">
            <div className="space-y-1">
              <p className="text-xs text-white/50">Filter by course</p>
              <select value={courseId} onChange={(e) => { setCourseId(e.target.value); }}
                className={FILTER_CONTROL_CLASS}>
                <option className={FILTER_OPTION_CLASS} value="">All courses</option>
                {courses.map((c) => <option className={FILTER_OPTION_CLASS} key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <Button onClick={loadEffectiveness} variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 h-8 px-3">
              <RefreshCw className="h-3.5 w-3.5 mr-1" /> Load
            </Button>
          </div>

          {loadingEff ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-lg bg-white/5" />)}</div>
          ) : (
            <>
              {effectiveness.length > 0 && (
                <div className="rounded-xl border border-white/10 bg-white/5 p-4 mb-4">
                  <h3 className="text-sm font-medium text-white/70 mb-4">Completion & Pass Rates</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={effectiveness.slice(0, 10)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="title" tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 9 }} interval={0} angle={-25} textAnchor="end" height={60} />
                      <YAxis tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 11 }} unit="%" />
                      <Tooltip contentStyle={{ background: "#0a1628", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, color: "#fff" }} />
                      <Legend wrapperStyle={{ color: "rgba(255,255,255,0.5)", fontSize: 12 }} />
                      <Bar dataKey="completionRate" name="Completion %" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="passRate" name="Pass %" fill="#22c55e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              <div className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-white/10 text-xs text-white/40">
                      <th className="px-4 py-3 text-left">Course</th>
                      <th className="px-4 py-3 text-right">Enrollments</th>
                      <th className="px-4 py-3 text-right">Completion %</th>
                      <th className="px-4 py-3 text-right">Pass %</th>
                      <th className="px-4 py-3 text-right">Avg Score</th>
                      <th className="px-4 py-3 text-right">Avg Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {effectiveness.map((r) => (
                      <tr key={r.id} className="hover:bg-white/[0.03]">
                        <td className="px-4 py-3 text-white/80">{r.title}</td>
                        <td className="px-4 py-3 text-right text-white/60">{r.totalEnrollments}</td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`border-0 text-xs ${r.completionRate >= 80 ? "bg-green-900/40 text-green-300" : r.completionRate >= 50 ? "bg-yellow-900/40 text-yellow-300" : "bg-red-900/40 text-red-300"}`}>
                            {r.completionRate}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Badge className={`border-0 text-xs ${r.passRate >= 80 ? "bg-green-900/40 text-green-300" : r.passRate >= 50 ? "bg-yellow-900/40 text-yellow-300" : "bg-red-900/40 text-red-300"}`}>
                            {r.passRate}%
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-right text-white/60">{r.avgScore !== null ? `${r.avgScore}%` : "—"}</td>
                        <td className="px-4 py-3 text-right text-white/60">
                          {r.avgTimeMinutes !== null
                            ? r.avgTimeMinutes >= 60
                              ? `${Math.floor(r.avgTimeMinutes / 60)}h ${r.avgTimeMinutes % 60}m`
                              : `${r.avgTimeMinutes}m`
                            : "—"}
                        </td>
                      </tr>
                    ))}
                    {effectiveness.length === 0 && (
                      <tr><td colSpan={6} className="px-4 py-8 text-center text-white/30 text-sm">No data. Click Load to fetch results.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
