"use client";

import { useEffect, useState } from "react";
import { Award, Download, CheckCircle } from "lucide-react";

interface UserBadge {
  id: string;
  awardedAt: string;
  reason: string | null;
  badge: { id: string; name: string; description: string | null; imageUrl: string | null; trigger: string; points: number };
}

interface DigitalCertificate {
  id: string;
  title: string;
  issuerName: string;
  recipientName: string;
  issuedAt: string;
  expiresAt: string | null;
  verifyCode: string;
}

export function AchievementsClient() {
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [certs, setCerts] = useState<DigitalCertificate[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/user/badges").then((r) => r.json()),
      fetch("/api/certificates").then((r) => r.json()),
    ]).then(([b, c]) => {
      setBadges(Array.isArray(b) ? b : []);
      setCerts(Array.isArray(c) ? c : []);
    }).finally(() => setLoading(false));
  }, []);

  const totalPoints = badges.reduce((sum, b) => sum + b.badge.points, 0);

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Badges Earned", value: badges.length, icon: "🏅" },
          { label: "Total Points", value: totalPoints, icon: "⭐" },
          { label: "Certificates", value: certs.length, icon: "🎓" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-5 text-center">
            <p className="text-3xl mb-1">{s.icon}</p>
            <p className="text-2xl font-bold text-k-navy">{s.value}</p>
            <p className="text-sm text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {loading ? (
        <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : (
        <>
          {/* Badges */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-bold text-k-navy">
              <Award className="h-5 w-5" /> Badges
            </h3>
            {badges.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
                Complete courses and assessments to earn badges!
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {badges.map((ub) => (
                  <div key={ub.id} className="rounded-xl border border-border bg-card p-4 text-center space-y-2">
                    {ub.badge.imageUrl
                      ? <img src={ub.badge.imageUrl} alt={ub.badge.name} className="mx-auto h-14 w-14 rounded-full object-cover" />
                      : <div className="mx-auto h-14 w-14 rounded-full bg-k-navy/10 flex items-center justify-center">
                          <Award className="h-7 w-7 text-k-navy" />
                        </div>}
                    <p className="text-sm font-semibold text-foreground leading-tight">{ub.badge.name}</p>
                    <p className="text-xs text-k-orange font-medium">{ub.badge.points} pts</p>
                    <p className="text-xs text-muted-foreground">{new Date(ub.awardedAt).toLocaleDateString()}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* Certificates */}
          <section className="space-y-3">
            <h3 className="flex items-center gap-2 text-lg font-bold text-k-navy">
              <CheckCircle className="h-5 w-5" /> Digital Certificates
            </h3>
            {certs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-muted-foreground">
                Complete courses to earn digital certificates!
              </div>
            ) : (
              <div className="rounded-xl border border-border bg-card overflow-hidden divide-y divide-border">
                {certs.map((cert) => {
                  const expired = cert.expiresAt && new Date(cert.expiresAt) < new Date();
                  return (
                    <div key={cert.id} className="flex items-center gap-4 px-5 py-4">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-k-navy/10 shrink-0">
                        <CheckCircle className="h-5 w-5 text-k-navy" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm text-foreground">{cert.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Issued {new Date(cert.issuedAt).toLocaleDateString()}
                          {cert.expiresAt && ` · ${expired ? "Expired" : "Expires"} ${new Date(cert.expiresAt).toLocaleDateString()}`}
                        </p>
                      </div>
                      {expired && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive shrink-0">Expired</span>}
                      <a href={`/api/certificates/${cert.id}/pdf`} target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-accent transition-colors shrink-0">
                        <Download className="h-3.5 w-3.5" /> PDF
                      </a>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
