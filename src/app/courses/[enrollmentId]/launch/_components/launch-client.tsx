"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, XCircle, ArrowLeft, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  enrollmentId: string;
  courseId: string;
  courseTitle: string;
  launchUrl: string;
  currentStatus: string;
}

type LaunchState = "loading" | "running" | "passed" | "failed" | "error";

export function LaunchClient({ enrollmentId, courseId, courseTitle, launchUrl, currentStatus }: Props) {
  const router = useRouter();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [state, setState] = useState<LaunchState>("loading");
  const [score, setScore] = useState<number | null>(null);
  const recordedRef = useRef(false);

  // On mount, call the launch API to record startedAt / increment attempts
  useEffect(() => {
    fetch(`/api/enrollments/${enrollmentId}/launch`, { method: "POST" }).catch(() => {});
  }, [enrollmentId]);

  // Listen for KLA_COMPLETE postMessage from the CBT iframe
  const handleMessage = useCallback(
    async (event: MessageEvent) => {
      if (event.data?.type !== "KLA_COMPLETE") return;
      if (recordedRef.current) return; // only record once
      recordedRef.current = true;

      const cbtScore: number | undefined = event.data.score;
      const cbtPassed: boolean | undefined = event.data.passed;

      setScore(cbtScore ?? null);
      setState(cbtPassed !== false ? "passed" : "failed");

      try {
        await fetch(`/api/enrollments/${enrollmentId}/complete`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            score: cbtScore ?? undefined,
            passed: cbtPassed ?? undefined,
            totalSeconds: event.data.totalSeconds ?? undefined,
            sections: event.data.sections ?? undefined,
            questions: event.data.questions ?? undefined,
          }),
        });
      } catch {
        // Non-fatal: we've already updated the UI
      }
    },
    [enrollmentId],
  );

  useEffect(() => {
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [handleMessage]);

  // If already passed, show the result overlay immediately
  useEffect(() => {
    if (currentStatus === "PASSED") setState("passed");
  }, [currentStatus]);

  return (
    <div className="relative flex h-screen w-screen flex-col bg-black">
      {/* narrow top bar */}
      <div className="flex h-10 shrink-0 items-center justify-between bg-[#001245] px-4">
        <button
          onClick={() => router.push("/my-courses")}
          className="flex items-center gap-1.5 text-xs text-white/60 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Exit
        </button>
        <span className="text-xs text-white/60 truncate max-w-[60vw]">{courseTitle}</span>
        <div className="w-16" />
      </div>

      {/* iframe area */}
      <div className="relative flex-1 overflow-hidden">
        {state === "loading" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black z-10">
            <Loader2 className="h-8 w-8 animate-spin text-white/40" />
          </div>
        )}

        <iframe
          ref={iframeRef}
          src={launchUrl}
          className="h-full w-full border-0"
          title={courseTitle}
          onLoad={() => setState((s) => (s === "loading" ? "running" : s))}
          onError={() => setState("error")}
        />

        {/* Result overlay */}
        {(state === "passed" || state === "failed") && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-white/10 bg-[#0a1628] p-10 text-center shadow-2xl max-w-sm w-full mx-4">
              {state === "passed" ? (
                <>
                  <CheckCircle2 className="h-16 w-16 text-emerald-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Course Complete!</h2>
                    {score !== null && (
                      <p className="mt-1 text-lg text-emerald-300">Score: {Math.round(score)}%</p>
                    )}
                    <p className="mt-2 text-sm text-white/50">Your completion has been recorded.</p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-16 w-16 text-red-400" />
                  <div>
                    <h2 className="text-2xl font-bold text-white">Not Passed</h2>
                    {score !== null && (
                      <p className="mt-1 text-lg text-red-300">Score: {Math.round(score)}%</p>
                    )}
                    <p className="mt-2 text-sm text-white/50">You can retake this course.</p>
                  </div>
                </>
              )}

              <div className="flex gap-3 mt-2">
                <Button
                  variant="outline"
                  className="border-white/20 text-white/70 hover:text-white"
                  onClick={() => router.push("/my-courses")}
                >
                  My Courses
                </Button>
                {state === "failed" && (
                  <Button
                    className="bg-[#cc3d00] text-white hover:bg-[#b33400]"
                    onClick={() => {
                      recordedRef.current = false;
                      setState("loading");
                      if (iframeRef.current) {
                        iframeRef.current.src = launchUrl;
                      }
                    }}
                  >
                    Retake
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}

        {state === "error" && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/80 z-20">
            <div className="text-center text-white p-8">
              <XCircle className="mx-auto mb-3 h-12 w-12 text-red-400" />
              <p className="font-medium">Could not load course content.</p>
              <p className="mt-1 text-sm text-white/50">Check that the course was uploaded correctly.</p>
              <Button
                className="mt-4 border-white/20 text-white"
                variant="outline"
                onClick={() => router.push("/my-courses")}
              >
                Go Back
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
