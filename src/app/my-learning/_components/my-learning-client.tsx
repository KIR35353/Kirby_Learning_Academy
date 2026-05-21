"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { BookOpen, CheckCircle2, Lock, PlayCircle, GraduationCap, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import Link from "next/link";

interface CourseStatus {
  id: string;
  title: string;
  category: string | null;
  duration: number | null;
}

interface CourseWithStatus {
  id: string;
  courseId: string;
  order: number;
  isRequired: boolean;
  prerequisiteCourseId: string | null;
  course: CourseStatus;
  enrollment: { id: string; status: string; score: number | null } | null;
  isUnlocked: boolean;
}

interface PathProgress {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  courses: CourseWithStatus[];
  progress: number;
  completedCount: number;
  totalRequired: number;
  isComplete: boolean;
}

interface CurriculumProgress {
  id: string;
  title: string;
  description: string | null;
  isActive: boolean;
  dueDate: string | null;
  paths: PathProgress[];
  progress: number;
  completedPaths: number;
  totalPaths: number;
  isComplete: boolean;
}

export function MyLearningClient() {
  const router = useRouter();
  const [curricula, setCurricula] = useState<CurriculumProgress[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPaths, setExpandedPaths] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/my-learning")
      .then((r) => r.json())
      .then((d) => setCurricula(d.curricula ?? []))
      .finally(() => setLoading(false));
  }, []);

  function togglePath(pathId: string) {
    setExpandedPaths((prev) => {
      const next = new Set(prev);
      if (next.has(pathId)) next.delete(pathId);
      else next.add(pathId);
      return next;
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-white/30" />
      </div>
    );
  }

  if (curricula.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-xl border border-white/10 bg-white/5 py-20 text-center">
        <GraduationCap className="h-12 w-12 text-white/20" />
        <div>
          <p className="font-medium text-white">No curricula assigned</p>
          <p className="mt-1 text-sm text-white/50">
            You haven&apos;t been assigned any curricula yet. Check the catalog for individual courses.
          </p>
        </div>
        <Link href="/catalog">
          <Button className="bg-[#cc3d00] text-white hover:bg-[#b33400]">Browse Catalog</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {curricula.map((curriculum) => (
        <div key={curriculum.id} className="rounded-xl border border-white/10 bg-white/5 overflow-hidden">
          {/* Curriculum header */}
          <div className="p-6 border-b border-white/10">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <GraduationCap className="h-5 w-5 text-[#cc3d00] shrink-0" />
                  <h2 className="text-lg font-semibold text-white truncate">{curriculum.title}</h2>
                  {curriculum.isComplete && (
                    <CheckCircle2 className="h-5 w-5 text-emerald-400 shrink-0" />
                  )}
                </div>
                {curriculum.description && (
                  <p className="text-sm text-white/50 mb-3">{curriculum.description}</p>
                )}
                {curriculum.dueDate && (
                  <p className="text-xs text-white/30 mb-3">
                    Due {new Date(curriculum.dueDate).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="text-right shrink-0">
                <p className="text-2xl font-bold text-white">{curriculum.progress}%</p>
                <p className="text-xs text-white/40">{curriculum.completedPaths}/{curriculum.totalPaths} paths</p>
              </div>
            </div>
            <Progress value={curriculum.progress} className="h-2 bg-white/10" />
          </div>

          {/* Paths */}
          <div className="divide-y divide-white/5">
            {curriculum.paths.map((path, pathIndex) => {
              const isExpanded = expandedPaths.has(path.id);
              return (
                <div key={path.id}>
                  <button
                    onClick={() => togglePath(path.id)}
                    className="w-full flex items-center gap-4 px-6 py-4 hover:bg-white/5 transition-colors text-left"
                  >
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium shrink-0 ${
                      path.isComplete
                        ? "bg-emerald-900/50 text-emerald-300"
                        : "bg-white/10 text-white/60"
                    }`}>
                      {path.isComplete ? <CheckCircle2 className="h-4 w-4" /> : pathIndex + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-white">{path.title}</p>
                      <p className="text-xs text-white/40 mt-0.5">
                        {path.completedCount}/{path.totalRequired} required courses completed
                      </p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="w-20">
                        <Progress value={path.progress} className="h-1.5 bg-white/10" />
                      </div>
                      <span className="text-xs text-white/40 w-8 text-right">{path.progress}%</span>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-white/30" /> : <ChevronDown className="h-4 w-4 text-white/30" />}
                    </div>
                  </button>

                  {isExpanded && (
                    <div className="px-6 pb-4 space-y-2">
                      {path.courses.map((lpc, courseIndex) => {
                        const isPassed = lpc.enrollment?.status === "PASSED" || lpc.enrollment?.status === "COMPLETED";
                        const isInProgress = lpc.enrollment?.status === "IN_PROGRESS";
                        const isLocked = !lpc.isUnlocked;

                        return (
                          <div
                            key={lpc.id}
                            className={`flex items-center gap-3 rounded-lg px-4 py-3 ${
                              isLocked ? "bg-white/3 opacity-50" : "bg-white/5 hover:bg-white/8"
                            } transition-colors`}
                          >
                            <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs shrink-0 ${
                              isPassed ? "bg-emerald-900/60 text-emerald-300" :
                              isInProgress ? "bg-amber-900/60 text-amber-300" :
                              isLocked ? "bg-white/5 text-white/20" :
                              "bg-white/10 text-white/50"
                            }`}>
                              {isPassed ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                               isLocked ? <Lock className="h-3.5 w-3.5" /> :
                               courseIndex + 1}
                            </div>

                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-white truncate">{lpc.course.title}</p>
                              <div className="flex items-center gap-2 mt-0.5">
                                {lpc.course.category && <span className="text-xs text-white/30">{lpc.course.category}</span>}
                                {lpc.course.duration && <span className="text-xs text-white/20">{lpc.course.duration}m</span>}
                                {!lpc.isRequired && <span className="text-[10px] text-white/30 bg-white/10 rounded-full px-1.5 py-0.5">Optional</span>}
                                {lpc.prerequisiteCourseId && isLocked && (
                                  <span className="text-[10px] text-amber-400/70">Prerequisite required</span>
                                )}
                              </div>
                            </div>

                            {lpc.enrollment?.score !== null && lpc.enrollment?.score !== undefined && (
                              <span className="text-xs text-white/40 shrink-0">{Math.round(lpc.enrollment.score)}%</span>
                            )}

                            {!isLocked && lpc.enrollment ? (
                              <Button
                                size="sm"
                                className="shrink-0 h-7 px-3 text-xs bg-[#cc3d00] text-white hover:bg-[#b33400]"
                                onClick={() => router.push(`/courses/${lpc.enrollment!.id}/launch`)}
                              >
                                <PlayCircle className="mr-1 h-3 w-3" />
                                {isPassed ? "Review" : isInProgress ? "Resume" : "Start"}
                              </Button>
                            ) : !isLocked ? (
                              <Link href="/catalog">
                                <Button size="sm" variant="outline" className="shrink-0 h-7 px-3 text-xs border-white/10 text-white/60 hover:bg-white/10">
                                  Enroll
                                </Button>
                              </Link>
                            ) : null}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
