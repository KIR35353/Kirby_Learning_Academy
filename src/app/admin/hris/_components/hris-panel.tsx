"use client";

import { useState } from "react";
import { RefreshCw, Upload, CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SyncLog {
  id: string;
  source: string;
  status: string;
  recordsIn: number;
  created: number;
  updated: number;
  deactivated: number;
  errors: string[] | null;
  startedAt: string;
  finishedAt: string | null;
}

interface Props {
  initial: SyncLog[];
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-green-500" />,
  failed:  <XCircle className="h-4 w-4 text-destructive" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-blue-400" />,
};

const STATUS_BADGE: Record<string, "default" | "destructive" | "secondary"> = {
  success: "default",
  failed:  "destructive",
  running: "secondary",
};

function formatDuration(start: string, end: string | null) {
  if (!end) return "…";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  return ms < 60_000 ? `${(ms / 1000).toFixed(1)}s` : `${(ms / 60_000).toFixed(1)}m`;
}

export function HrisPanel({ initial }: Props) {
  const [logs, setLogs] = useState<SyncLog[]>(initial);
  const [triggering, setTriggering] = useState(false);
  const [source, setSource] = useState<"workday" | "successfactors" | "csv">("workday");
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function refreshLogs() {
    const res = await fetch("/api/admin/hris/sync?limit=20");
    if (res.ok) setLogs(await res.json() as SyncLog[]);
  }

  async function triggerSync() {
    setTriggering(true);
    setMessage(null);
    try {
      let csvContent: string | undefined;
      if (source === "csv") {
        if (!csvFile) {
          setMessage({ type: "error", text: "Please select a CSV file." });
          return;
        }
        csvContent = await csvFile.text();
      }

      const res = await fetch("/api/admin/hris/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ source, csvContent }),
      });

      if (!res.ok) {
        const data = await res.json() as { error?: string };
        setMessage({ type: "error", text: data.error ?? "Failed to queue sync." });
        return;
      }

      setMessage({ type: "success", text: "Sync job queued — check logs below." });
      setTimeout(refreshLogs, 2000);
    } finally {
      setTriggering(false);
    }
  }

  return (
    <div className="space-y-8">
      {/* Trigger panel */}
      <div className="rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold">Trigger HRIS Sync</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Syncs run automatically every night at 02:00 UTC. Use this to trigger an immediate sync.
        </p>

        <div className="mt-5 flex flex-wrap items-end gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium" htmlFor="hris-source">
              Source
            </label>
            <select
              id="hris-source"
              value={source}
              onChange={(e) => setSource(e.target.value as typeof source)}
              className="rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="workday">Workday</option>
              <option value="successfactors">SAP SuccessFactors</option>
              <option value="csv">CSV Upload</option>
            </select>
          </div>

          {source === "csv" && (
            <div className="space-y-1.5">
              <label className="text-sm font-medium" htmlFor="csv-file">
                CSV File
              </label>
              <div className="flex items-center gap-2">
                <label
                  htmlFor="csv-file"
                  className="flex cursor-pointer items-center gap-1.5 rounded-md border border-dashed border-input px-3 py-2 text-sm hover:bg-muted/40 transition-colors"
                >
                  <Upload className="h-4 w-4" />
                  {csvFile ? csvFile.name : "Choose file…"}
                </label>
                <input
                  id="csv-file"
                  type="file"
                  accept=".csv,text/csv"
                  className="sr-only"
                  onChange={(e) => setCsvFile(e.target.files?.[0] ?? null)}
                />
              </div>
            </div>
          )}

          <Button onClick={triggerSync} disabled={triggering}>
            {triggering ? (
              <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-1.5 h-4 w-4" />
            )}
            {triggering ? "Queuing…" : "Run Sync Now"}
          </Button>
        </div>

        {message && (
          <p
            className={`mt-3 text-sm ${
              message.type === "success" ? "text-green-600 dark:text-green-400" : "text-destructive"
            }`}
          >
            {message.text}
          </p>
        )}
      </div>

      {/* Sync logs */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Sync History</h2>
          <Button variant="outline" size="sm" onClick={refreshLogs}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
        </div>

        {logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-border py-12 text-center">
            <Clock className="mb-2 h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">No sync runs yet.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <th className="px-4 py-2.5 text-left">Status</th>
                  <th className="px-4 py-2.5 text-left">Source</th>
                  <th className="px-4 py-2.5 text-left">Started</th>
                  <th className="px-4 py-2.5 text-right">Duration</th>
                  <th className="px-4 py-2.5 text-right">In</th>
                  <th className="px-4 py-2.5 text-right">Created</th>
                  <th className="px-4 py-2.5 text-right">Updated</th>
                  <th className="px-4 py-2.5 text-right">Deactivated</th>
                  <th className="px-4 py-2.5 text-right">Errors</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b border-border/50 hover:bg-muted/20">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {STATUS_ICON[log.status] ?? STATUS_ICON.running}
                        <Badge variant={STATUS_BADGE[log.status] ?? "secondary"} className="text-xs">
                          {log.status}
                        </Badge>
                      </div>
                    </td>
                    <td className="px-4 py-3 capitalize">{log.source}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {new Date(log.startedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right text-muted-foreground">
                      {formatDuration(log.startedAt, log.finishedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">{log.recordsIn}</td>
                    <td className="px-4 py-3 text-right text-green-600 dark:text-green-400">
                      {log.created > 0 ? `+${log.created}` : log.created}
                    </td>
                    <td className="px-4 py-3 text-right">{log.updated}</td>
                    <td className="px-4 py-3 text-right text-orange-500">
                      {log.deactivated > 0 ? log.deactivated : "—"}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {log.errors && log.errors.length > 0 ? (
                        <span className="text-destructive font-medium">{log.errors.length}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
