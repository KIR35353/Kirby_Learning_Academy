import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { CertificationsClient } from "./_components/certifications-client";

export const metadata = { title: "Certifications — Admin" };

export default async function CertificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const roles = session.user.roles ?? [];
  const allowed = roles.some((r) => ["SUPER_ADMIN", "TENANT_ADMIN", "COMPLIANCE_OFFICER"].includes(r));
  if (!allowed) redirect("/unauthorized");

  const [certifications, courses, users] = await Promise.all([
    db.certification.findMany({
      where: { tenantId: session.user.tenantId },
      include: {
        renewalCourse: { select: { id: true, title: true } },
        _count: { select: { records: true, requirements: true } },
      },
      orderBy: [{ framework: "asc" }, { name: "asc" }],
    }),
    db.course.findMany({
      where: { tenantId: session.user.tenantId, status: "PUBLISHED" },
      select: { id: true, title: true },
      orderBy: { title: "asc" },
    }),
    db.user.findMany({
      where: { tenantId: session.user.tenantId, isActive: true },
      select: { id: true, name: true, email: true },
      orderBy: { name: "asc" },
      take: 500,
    }),
  ]);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Certifications" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <CertificationsClient
            initialCertifications={certifications}
            courses={courses}
            users={users}
          />
        </main>
      </div>
    </div>
  );
}
