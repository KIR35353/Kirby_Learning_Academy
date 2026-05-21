"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, BookOpen, RotateCcw } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────

interface CourseSummary { id: string; title: string }

interface AssessmentSummary {
  id: string; title: string; description: string | null;
  type: string; passingScore: number;
  maxAttempts: number | null; timeLimitMinutes: number | null;
  remediationCourseId: string | null;
  remediationCourse: CourseSummary | null;
  _count: { questions: number };
}

interface AttemptSummary {
  id: string; status: string; score: number | null; passed: boolean | null;
  startedAt: string; submittedAt: string | null;
}

interface QuestionOption { id: string; text: string; isCorrect?: boolean }
interface AttemptQuestion {
  id: string; type: string; text: string; explanation: string | null; points: number;
  options: QuestionOption[];
}
interface AttemptData {
  attemptId: string;
  questions: AttemptQuestion[];
  expiresAt: string | null;
}

interface AnswerResult {
  questionId: string; isCorrect: boolean; pointsEarned: number;
  selectedOptionIds: string[]; acknowledged: boolean;
  correctOptionIds: string[]; explanation: string | null;
}

interface SubmitResult {
  score: number; passed: boolean; earnedPoints: number; totalPoints: number;
  remediationCourseId: string | null;
  answers: AnswerResult[];
  questions: AttemptQuestion[];
}

type Phase = "idle" | "starting" | "taking" | "submitting" | "results";

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(s: string) {
  return new Date(s).toLocaleString();
}

function useCountdown(expiresAt: string | null, onExpire: () => void) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const cb = useRef(onExpire);
  cb.current = onExpire;

  useEffect(() => {
    if (!expiresAt) { setRemaining(null); return; }
    const tick = () => {
      const left = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
      setRemaining(left);
      if (left === 0) cb.current();
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  return remaining;
}

// ── Main component ─────────────────────────────────────────────────────────

export function AssessmentClient({
  assessment,
  initialAttempts,
}: {
  assessment: AssessmentSummary;
  initialAttempts: AttemptSummary[];
}) {
  const [phase, setPhase] = useState<Phase>("idle");
  const [attempts, setAttempts] = useState(initialAttempts);
  const [attemptData, setAttemptData] = useState<AttemptData | null>(null);
  const [results, setResults] = useState<SubmitResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Answers keyed by questionId
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string[]>>({});
  const [acknowledged, setAcknowledged] = useState<Record<string, boolean>>({});

  const autoSubmit = useCallback(async () => {
    if (!attemptData) return;
    setPhase("submitting");
    await submitAnswers(attemptData);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attemptData]);

  const remaining = useCountdown(attemptData?.expiresAt ?? null, autoSubmit);

  async function startAssessment() {
    setPhase("starting"); setError(null);
    const res = await fetch(`/api/assessments/${assessment.id}/start`, { method: "POST" });
    if (!res.ok) {
      const e = await res.json();
      setError(e.error ?? "Failed to start");
      setPhase("idle"); return;
    }
    const data: AttemptData = await res.json();
    setAttemptData(data);
    setSelectedOptions({});
    setAcknowledged({});
    setPhase("taking");
  }

  function toggleOption(questionId: string, optionId: string, qtype: string) {
    setSelectedOptions((prev) => {
      const cur = prev[questionId] ?? [];
      if (qtype === "MULTIPLE_CHOICE" || qtype === "TRUE_FALSE") {
        return { ...prev, [questionId]: [optionId] };
      }
      // MULTI_SELECT toggle
      if (cur.includes(optionId)) return { ...prev, [questionId]: cur.filter((x) => x !== optionId) };
      return { ...prev, [questionId]: [...cur, optionId] };
    });
  }

  async function submitAnswers(data: AttemptData) {
    setPhase("submitting");
    const answers = data.questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: selectedOptions[q.id] ?? [],
      acknowledged: acknowledged[q.id] ?? false,
    }));
    const res = await fetch(`/api/assessments/${assessment.id}/attempts/${data.attemptId}/submit`, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ answers }),
    });
    if (!res.ok) { setError("Submission failed"); setPhase("taking"); return; }
    const result: SubmitResult = await res.json();
    setResults(result);
    // Refresh attempts
    const attRes = await fetch(`/api/assessments/${assessment.id}/attempts`);
    if (attRes.ok) setAttempts(await attRes.json());
    setPhase("results");
  }

  const completedAttempts = attempts.filter((a) => a.status === "PASSED" || a.status === "FAILED");
  const canStart = !assessment.maxAttempts || completedAttempts.length < assessment.maxAttempts;

  // ── IDLE ──────────────────────────────────────────────────────────────
  if (phase === "idle" || phase === "starting") {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="rounded-xl border border-white/10 bg-white/5 p-6 space-y-4">
          <h2 className="text-xl font-semibold text-white">{assessment.title}</h2>
          {assessment.description && <p className="text-white/60 text-sm">{assessment.description}</p>}

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-lg bg-white/5 px-4 py-3">
              <p className="text-white/40 text-xs">Questions</p>
              <p className="text-white font-medium">{assessment._count.questions}</p>
            </div>
            <div className="rounded-lg bg-white/5 px-4 py-3">
              <p className="text-white/40 text-xs">Passing score</p>
              <p className="text-white font-medium">{assessment.passingScore}%</p>
            </div>
            {assessment.timeLimitMinutes && (
              <div className="rounded-lg bg-white/5 px-4 py-3 flex items-center gap-2">
                <Clock className="h-4 w-4 text-white/40" />
                <div>
                  <p className="text-white/40 text-xs">Time limit</p>
                  <p className="text-white font-medium">{assessment.timeLimitMinutes} min</p>
                </div>
              </div>
            )}
            {assessment.maxAttempts && (
              <div className="rounded-lg bg-white/5 px-4 py-3">
                <p className="text-white/40 text-xs">Attempts</p>
                <p className="text-white font-medium">{completedAttempts.length} / {assessment.maxAttempts}</p>
              </div>
            )}
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <Button onClick={startAssessment} disabled={!canStart || phase === "starting"}
            className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
            {phase === "starting" ? "Starting…" : canStart ? (completedAttempts.length > 0 ? "Retake Assessment" : "Start Assessment") : "No attempts remaining"}
          </Button>
        </div>

        {attempts.length > 0 && (
          <div className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
            <h3 className="text-sm font-medium text-white/70">Attempt history</h3>
            {attempts.map((a) => (
              <div key={a.id} className="flex items-center justify-between text-sm">
                <span className="text-white/40">{formatDate(a.startedAt)}</span>
                <div className="flex items-center gap-2">
                  {a.score != null && <span className="text-white/60">{a.score.toFixed(0)}%</span>}
                  <Badge className={`text-[10px] border-0 ${a.status === "PASSED" ? "bg-emerald-900/50 text-emerald-300" : a.status === "FAILED" ? "bg-red-900/50 text-red-300" : "bg-white/10 text-white/40"}`}>
                    {a.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── TAKING ─────────────────────────────────────────────────────────────
  if ((phase === "taking" || phase === "submitting") && attemptData) {
    const mins = remaining != null ? Math.floor(remaining / 60) : null;
    const secs = remaining != null ? remaining % 60 : null;

    return (
      <div className="max-w-2xl mx-auto space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">{assessment.title}</h2>
          {remaining != null && (
            <div className={`flex items-center gap-1.5 text-sm font-mono ${remaining < 60 ? "text-red-400" : "text-white/60"}`}>
              <Clock className="h-4 w-4" />
              {String(mins).padStart(2, "0")}:{String(secs).padStart(2, "0")}
            </div>
          )}
        </div>

        <div className="space-y-4">
          {attemptData.questions.map((q, qi) => (
            <div key={q.id} className="rounded-xl border border-white/10 bg-white/5 p-5 space-y-3">
              <div className="flex items-start gap-3">
                <span className="text-white/30 text-sm shrink-0">{qi + 1}.</span>
                <p className="text-white text-sm leading-relaxed">{q.text}</p>
              </div>

              {q.type === "ATTESTATION" ? (
                <label className="flex items-center gap-2.5 cursor-pointer pl-5">
                  <input type="checkbox" checked={acknowledged[q.id] ?? false}
                    onChange={(e) => setAcknowledged((prev) => ({ ...prev, [q.id]: e.target.checked }))}
                    className="h-4 w-4 accent-[#cc3d00]" />
                  <span className="text-sm text-white/70">I acknowledge this statement</span>
                </label>
              ) : (
                <div className="pl-5 space-y-2">
                  {q.options.map((opt) => {
                    const sel = (selectedOptions[q.id] ?? []).includes(opt.id);
                    const isCheckbox = q.type === "MULTI_SELECT";
                    return (
                      <label key={opt.id} className="flex items-center gap-2.5 cursor-pointer">
                        <input
                          type={isCheckbox ? "checkbox" : "radio"}
                          name={q.id}
                          checked={sel}
                          onChange={() => toggleOption(q.id, opt.id, q.type)}
                          className="h-4 w-4 accent-[#cc3d00]"
                        />
                        <span className="text-sm text-white/70">{opt.text}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        <Button onClick={() => submitAnswers(attemptData)} disabled={phase === "submitting"}
          className="w-full bg-[#cc3d00] text-white hover:bg-[#b33400]">
          {phase === "submitting" ? "Submitting…" : "Submit Assessment"}
        </Button>
      </div>
    );
  }

  // ── RESULTS ───────────────────────────────────────────────────────────
  if (phase === "results" && results) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Score banner */}
        <div className={`rounded-xl border p-6 text-center space-y-2 ${results.passed ? "border-emerald-500/30 bg-emerald-900/20" : "border-red-500/30 bg-red-900/20"}`}>
          {results.passed
            ? <CheckCircle className="h-10 w-10 text-emerald-400 mx-auto" />
            : <XCircle className="h-10 w-10 text-red-400 mx-auto" />}
          <h2 className={`text-2xl font-bold ${results.passed ? "text-emerald-300" : "text-red-300"}`}>
            {results.passed ? "Passed!" : "Not Passed"}
          </h2>
          <p className="text-white/60">
            Score: {results.score.toFixed(0)}% — {results.earnedPoints}/{results.totalPoints} points
            {" | "} Pass mark: {assessment.passingScore}%
          </p>
        </div>

        {/* Remediation */}
        {!results.passed && results.remediationCourseId && assessment.remediationCourse && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-900/10 p-4 flex items-center gap-4">
            <BookOpen className="h-6 w-6 text-amber-400 shrink-0" />
            <div className="flex-1">
              <p className="text-sm text-amber-300 font-medium">Recommended remediation</p>
              <p className="text-xs text-amber-300/70">{assessment.remediationCourse.title}</p>
            </div>
            <Link href={`/courses/${results.remediationCourseId}`}>
              <Button className="bg-amber-600 text-white hover:bg-amber-700 text-sm">Go to Course</Button>
            </Link>
          </div>
        )}

        {/* Per-question breakdown */}
        <div className="space-y-3">
          <h3 className="text-sm font-medium text-white/70">Answer breakdown</h3>
          {results.questions.map((q, qi) => {
            const ans = results.answers.find((a) => a.questionId === q.id);
            const correct = ans?.isCorrect ?? false;
            return (
              <div key={q.id} className={`rounded-xl border p-4 space-y-2 ${correct ? "border-emerald-500/20 bg-emerald-900/10" : "border-red-500/20 bg-red-900/10"}`}>
                <div className="flex items-start gap-2">
                  {correct
                    ? <CheckCircle className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
                    : <XCircle className="h-4 w-4 text-red-400 mt-0.5 shrink-0" />}
                  <p className="text-sm text-white">{qi + 1}. {q.text}</p>
                </div>

                {q.type === "ATTESTATION" ? (
                  <p className="text-xs text-white/50 pl-6">
                    {ans?.acknowledged ? "Acknowledged ✓" : "Not acknowledged"}
                  </p>
                ) : (
                  <div className="pl-6 space-y-1">
                    {q.options.map((opt) => {
                      const wasSelected = (ans?.selectedOptionIds ?? []).includes(opt.id);
                      const isCorrectOpt = (ans?.correctOptionIds ?? []).includes(opt.id);
                      let cls = "text-white/40";
                      if (isCorrectOpt) cls = "text-emerald-300";
                      else if (wasSelected && !isCorrectOpt) cls = "text-red-300";
                      return (
                        <p key={opt.id} className={`text-xs ${cls}`}>
                          {wasSelected ? "● " : "○ "}{opt.text}
                          {isCorrectOpt && " ✓"}
                        </p>
                      );
                    })}
                  </div>
                )}

                {q.explanation && (
                  <p className="pl-6 text-xs text-white/40 italic">{q.explanation}</p>
                )}
              </div>
            );
          })}
        </div>

        <div className="flex gap-3">
          {canStart && (
            <Button onClick={() => { setPhase("idle"); }} variant="outline"
              className="border-white/10 text-white/70 hover:bg-white/10 flex items-center gap-2">
              <RotateCcw className="h-4 w-4" /> Retake
            </Button>
          )}
          <Link href="/assessments" className="flex-1">
            <Button className="w-full bg-white/10 text-white hover:bg-white/20">Back to My Assessments</Button>
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
