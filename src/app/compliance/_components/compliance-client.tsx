"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2, Clock, XCircle, AlertTriangle, ShieldAlert, Award } from "lucide-react";

type Status = "PENDING" | "VALID" | "EXPIRING_SOON" | "EXPIRED" | "SUSPENDED";

interface CertRecord {
  id: string;
  status: Status;
  issuedAt: string | null;
  expiresAt: string | null;
  notes: string | null;
  certification: { id: string; name: string; framework: string; type: string };
  history: { id: string; toStatus: string; changedAt: string; reason: string | null }[];
}

const STATUS_CONFIG: Record<Status, { icon: React.ReactNode; color: string; label: string }> = {
  VALID: { icon: <CheckCircle2 className="h-4 w-4 text-green-400" />, color: "bg-green-900/40 text-green-300", label: "Valid" },
  EXPIRING_SOON: { icon: <Clock className="h-4 w-4 text-yellow-400" />, color: "bg-yellow-900/40 text-yellow-300", label: "Expiring Soon" },
  EXPIRED: { icon: <XCircle className="h-4 w-4 text-red-400" />, color: "bg-red-900/40 text-red-300", label: "Expired" },
  PENDING: { icon: <AlertTriangle className="h-4 w-4 text-white/40" />, color: "bg-white/10 text-white/50", label: "Pending" },
  SUSPENDED: { icon: <ShieldAlert className="h-4 w-4 text-orange-400" />, color: "bg-orange-900/40 text-orange-300", label: "Suspended" },
};

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86400000);
}

const GROUP_ORDER: Status[] = ["EXPIRING_SOON", "VALID", "PENDING", "EXPIRED", "SUSPENDED"];

export function ComplianceClient() {
  const [records, setRecords] = useState<CertRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/compliance")
      .then((r) => r.json())
      .then((data: CertRecord[]) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, []);

  const grouped = GROUP_ORDER.map((status) => ({
    status,
    items: records.filter((r) => r.status === status),
  })).filter((g) => g.items.length > 0);

  if (loading) return (
    <div className="space-y-4">
      {[1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-xl bg-white/5" />)}
    </div>
  );

  if (records.length === 0) return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-20 text-center">
      <Award className="h-12 w-12 text-white/20" />
      <p className="text-sm text-white/50">No certifications on record.</p>
      <p className="text-xs text-white/30">Certifications will appear here once issued by your administrator or completed via a course.</p>
    </div>
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-xl font-semibold text-white">My Certifications</h2>
        <p className="text-sm text-white/50">{records.length} certification{records.length !== 1 ? "s" : ""} on record</p>
      </div>

      {grouped.map(({ status, items }) => {
        const config = STATUS_CONFIG[status];
        return (
          <div key={status} className="space-y-2">
            <div className="flex items-center gap-2 mb-3">
              {config.icon}
              <h3 className="text-sm font-medium text-white/70">{config.label}</h3>
              <span className="text-xs text-white/30">({items.length})</span>
            </div>
            {items.map((r) => {
              const days = daysUntil(r.expiresAt);
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id}
                  onClick={() => setExpandedId(isExpanded ? null : r.id)}
                  className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 cursor-pointer hover:bg-white/[0.07] transition-colors">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="font-medium text-white text-sm">{r.certification.name}</p>
                      <p className="text-xs text-white/40 mt-0.5">{r.certification.framework.replace("_", " ")} · {r.certification.type}</p>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <Badge className={`border-0 text-xs ${config.color}`}>{config.label}</Badge>
                      {r.expiresAt && (
                        <span className="text-[10px] text-white/30">
                          {days !== null && days < 0
                            ? `Expired ${Math.abs(days)}d ago`
                            : days !== null
                              ? `${days}d remaining`
                              : new Date(r.expiresAt).toLocaleDateString()}
                        </span>
                      )}
                      {!r.expiresAt && <span className="text-[10px] text-white/30">No expiry</span>}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs text-white/50 space-y-1">
                      {r.issuedAt && <p>Issued: {new Date(r.issuedAt).toLocaleDateString()}</p>}
                      {r.notes && <p>Notes: {r.notes}</p>}
                      {r.history.length > 0 && (
                        <div className="pt-1 space-y-0.5">
                          <p className="text-white/30 font-medium">History</p>
                          {r.history.map((h) => (
                            <p key={h.id} className="text-white/30">
                              {new Date(h.changedAt).toLocaleDateString()} — {h.toStatus.replace("_", " ")}
                              {h.reason ? ` (${h.reason})` : ""}
                            </p>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
