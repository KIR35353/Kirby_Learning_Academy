"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ClipboardList, CheckCircle, XCircle, Clock } from "lucide-react";

interface LatestAttempt {
  status: string;
  score: number | null;
  passed: boolean | null;
}

interface AssignedAssessment {
  id: string;
  title: string;
  description: string | null;
  type: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  _count: { questions: number };
  latestAttempt: LatestAttempt | null;
  dueDate: string | null;
}

export function AssessmentsListClient({ userId }: { userId: string }) {
  const [assessments, setAssessments] = useState<AssignedAssessment[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const res = await fetch("/api/assessments");
      if (res.ok) setAssessments(await res.json());
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  if (loading) return <div className="text-white/40 text-sm">Loading…</div>;

  if (assessments.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-xl border border-white/10 bg-white/5 py-16 text-center">
        <ClipboardList className="h-10 w-10 text-white/20" />
        <p className="text-sm text-white/50">No assessments assigned to you.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-white">My Assessments</h2>
        <p className="text-sm text-white/50">{assessments.length} assignment{assessments.length !== 1 ? "s" : ""}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {assessments.map((a) => {
          const attempt = a.latestAttempt;
          const done = attempt?.status === "PASSED" || attempt?.status === "FAILED";
          const passed = attempt?.passed;

          return (
            <div key={a.id} className="rounded-xl border border-white/10 bg-white/5 p-5 flex flex-col gap-3">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium text-white leading-snug">{a.title}</h3>
                {done && (
                  passed
                    ? <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
                    : <XCircle className="h-5 w-5 text-red-400 shrink-0" />
                )}
              </div>
              {a.description && <p className="text-xs text-white/40 line-clamp-2">{a.description}</p>}
              <div className="flex flex-wrap gap-1.5">
                <Badge className="bg-white/10 text-white/40 border-0 text-[10px]">
                  {a.type === "ATTESTATION" ? "Attestation" : `${a._count.questions} question${a._count.questions !== 1 ? "s" : ""}`}
                </Badge>
                <Badge className="bg-white/10 text-white/40 border-0 text-[10px]">Pass: {a.passingScore}%</Badge>
                {a.timeLimitMinutes && (
                  <Badge className="bg-white/10 text-white/40 border-0 text-[10px] flex items-center gap-0.5">
                    <Clock className="h-2.5 w-2.5" />{a.timeLimitMinutes}m
                  </Badge>
                )}
                {a.dueDate && (
                  <Badge className="bg-amber-900/40 text-amber-300 border-0 text-[10px]">
                    Due {new Date(a.dueDate).toLocaleDateString()}
                  </Badge>
                )}
              </div>
              {done && (
                <p className={`text-sm font-medium ${passed ? "text-emerald-400" : "text-red-400"}`}>
                  Score: {attempt!.score?.toFixed(0)}% — {passed ? "Passed" : "Failed"}
                </p>
              )}
              <div className="mt-auto">
                <Link href={`/assessments/${a.id}`}>
                  <Button className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400] text-sm">
                    {attempt ? (done ? "View Results / Retake" : "Resume") : "Start Assessment"}
                  </Button>
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
