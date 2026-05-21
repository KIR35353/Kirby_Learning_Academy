"use client";

import { useEffect, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Download, AlertTriangle, CheckCircle2, Clock, XCircle, ShieldAlert } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

type Status = "PENDING" | "VALID" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED";

interface DashboardData {
  summary: Record<Status, number>;
  expiringRecords: ExpiringRecord[];
  frameworkSummary: { framework: string; status: string; count: number }[];
  recentAuditLogs: AuditEntry[];
}

interface ExpiringRecord {
  id: string;
  status: Status;
  expiresAt: string | null;
  user: { id: string; name: string | null; email: string; department?: { name: string } | null };
  certification: { id: string; name: string; framework: string };
}

interface AuditEntry {
  id: string;
  action: string;
  createdAt: string;
  actor: { id: string; name: string | null } | null;
  meta: Record<string, unknown> | null;
}

const STATUS_ICON: Record<Status, React.ReactNode> = {
  VALID: <CheckCircle2 className="h-5 w-5 text-green-400" />,
  EXPIRING_SOON: <Clock className="h-5 w-5 text-yellow-400" />,
  EXPIRED: <XCircle className="h-5 w-5 text-red-400" />,
  PENDING: <AlertTriangle className="h-5 w-5 text-white/40" />,
  SUSPENDED: <ShieldAlert className="h-5 w-5 text-orange-400" />,
};

const STATUS_LABEL_COLORS: Record<Status, string> = {
  VALID: "bg-green-900/40 text-green-300",
  EXPIRING_SOON: "bg-yellow-900/40 text-yellow-300",
  EXPIRED: "bg-red-900/40 text-red-300",
  PENDING: "bg-white/10 text-white/50",
  SUSPENDED: "bg-orange-900/40 text-orange-300",
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

// ── Component ──────────────────────────────────────────────────────────────

export function ComplianceDashboardClient({ departments }: { departments: { id: string; name: string }[] }) {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [deptId, setDeptId] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{ expired: number; expiringSoon: number } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const params = deptId ? `?departmentId=${deptId}` : "";
    const res = await fetch(`/api/admin/compliance/dashboard${params}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  }, [deptId]);

  useEffect(() => { load(); }, [load]);

  async function scanExpiry() {
    setScanning(true);
    const res = await fetch("/api/admin/compliance/scan-expiry", { method: "POST" });
    if (res.ok) {
      const result = await res.json();
      setScanResult(result);
      await load();
    }
    setScanning(false);
  }

  function exportCSV() {
    const params = new URLSearchParams();
    if (deptId) params.set("departmentId", deptId);
    window.open(`/api/admin/compliance/export?${params.toString()}`, "_blank");
  }

  const STATUSES: Status[] = ["VALID", "EXPIRING_SOON", "EXPIRED", "PENDING", "SUSPENDED"];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold text-white">Compliance Dashboard</h2>
          <p className="text-sm text-white/50">Organization-wide certification status</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={deptId} onChange={(e) => setDeptId(e.target.value)}
            className="rounded-lg bg-white/5 border border-white/10 text-white/70 px-3 py-1.5 text-sm">
            <option value="">All departments</option>
            {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
          <Button onClick={load} variant="outline" className="border-white/10 text-white/60 hover:bg-white/10 h-8 px-3">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Refresh
          </Button>
          <Button onClick={scanExpiry} disabled={scanning} variant="outline" className="border-yellow-900/40 text-yellow-400 hover:bg-yellow-900/20 h-8 px-3">
            {scanning ? "Scanning…" : "Scan Expiry"}
          </Button>
          <Button onClick={exportCSV} className="bg-[#cc3d00] text-white hover:bg-[#b33400] h-8 px-3">
            <Download className="h-3.5 w-3.5 mr-1" /> Export CSV
          </Button>
        </div>
      </div>

      {scanResult && (
        <div className="rounded-lg border border-yellow-900/30 bg-yellow-900/10 px-4 py-2.5 text-sm text-yellow-300">
          Scan complete: {scanResult.expired} expired, {scanResult.expiringSoon} expiring soon updated.
        </div>
      )}

      {/* Status summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {STATUSES.map((s) => (
          <Card key={s} className="bg-white/5 border-white/10 p-4 flex flex-col gap-1">
            <div className="flex items-center gap-2">
              {STATUS_ICON[s]}
              <span className="text-xs text-white/50">{s.replace("_", " ")}</span>
            </div>
            {loading ? (
              <Skeleton className="h-7 w-12 bg-white/10 mt-1" />
            ) : (
              <p className="text-2xl font-semibold text-white">{data?.summary[s] ?? 0}</p>
            )}
          </Card>
        ))}
      </div>

      {/* Framework breakdown */}
      {!loading && data && data.frameworkSummary.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5 p-4">
          <h3 className="text-sm font-medium text-white/70 mb-3">By Framework</h3>
          <div className="space-y-2">
            {Array.from(new Set(data.frameworkSummary.map((r) => r.framework))).map((fw) => {
              const rows = data.frameworkSummary.filter((r) => r.framework === fw);
              return (
                <div key={fw} className="flex items-center gap-2 flex-wrap text-xs">
                  <span className="text-white/60 w-24 shrink-0">{fw.replace("_", " ")}</span>
                  {rows.map((r) => (
                    <Badge key={r.status} className={`border-0 ${STATUS_LABEL_COLORS[r.status as Status]}`}>
                      {r.status.replace("_", " ")}: {r.count}
                    </Badge>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Expiring soon */}
      <div className="rounded-xl border border-white/10 bg-white/5">
        <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
          <h3 className="text-sm font-medium text-white/70">Expiring in Next 90 Days</h3>
          {!loading && <span className="text-xs text-white/40">{data?.expiringRecords.length ?? 0} records</span>}
        </div>
        {loading ? (
          <div className="p-4 space-y-2">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-10 bg-white/5 rounded-lg" />)}</div>
        ) : data?.expiringRecords.length === 0 ? (
          <p className="text-sm text-white/40 text-center py-8">No records expiring in the next 90 days.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {data!.expiringRecords.map((r) => {
              const days = daysUntil(r.expiresAt);
              return (
                <div key={r.id} className="flex items-center gap-4 px-4 py-3 text-sm">
                  <div className="flex-1 min-w-0">
                    <p className="text-white/80 font-medium truncate">{r.user.name ?? r.user.email}</p>
                    <p className="text-white/40 text-xs">{r.user.department?.name ?? "—"} · {r.certification.name}</p>
                  </div>
                  <Badge className={`border-0 text-xs ${STATUS_LABEL_COLORS[r.status]}`}>{r.status.replace("_", " ")}</Badge>
                  <span className="text-xs text-white/40 shrink-0">
                    {days !== null ? (days <= 0 ? "Expired" : `${days}d left`) : "—"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Recent audit log */}
      {!loading && data && data.recentAuditLogs.length > 0 && (
        <div className="rounded-xl border border-white/10 bg-white/5">
          <h3 className="text-sm font-medium text-white/70 px-4 py-3 border-b border-white/10">Recent Activity</h3>
          <div className="divide-y divide-white/5">
            {data.recentAuditLogs.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-2.5 text-xs">
                <span className="text-white/40 font-mono shrink-0">{new Date(a.createdAt).toLocaleDateString()}</span>
                <span className="text-white/60">{a.action.replace(/_/g, " ")}</span>
                {a.actor && <span className="text-white/40">by {a.actor.name ?? "Unknown"}</span>}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
