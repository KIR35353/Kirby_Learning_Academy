import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { Sidebar, TopNav } from "@/components/layout";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { CalendarDays, Building2, MapPin, Briefcase, Mail, HardHat } from "lucide-react";

export const metadata = { title: "My Profile" };

const ROLE_LABELS: Record<string, string> = {
  SUPER_ADMIN: "Super Admin",
  TENANT_ADMIN: "Admin",
  MANAGER: "Manager",
  INSTRUCTOR: "Instructor",
  STUDENT: "Student",
};

export default async function ProfilePage() {
  const session = await auth();
  if (!session) redirect("/login");

  const userId = session.user?.id;
  if (!userId) redirect("/login");

  const user = await db.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      name: true,
      displayName: true,
      avatarUrl: true,
      bio: true,
      isContractor: true,
      hireDate: true,
      emailVerified: true,
      createdAt: true,
      department: { select: { name: true } },
      location: { select: { name: true, city: true, state: true } },
      jobTitle: { select: { name: true } },
      roles: { select: { role: { select: { name: true } } } },
    },
  });

  if (!user) redirect("/login");

  const displayName = user.displayName ?? user.name ?? user.email;
  const initials = displayName
    .split(" ")
    .slice(0, 2)
    .map((s: string) => s[0])
    .join("")
    .toUpperCase();

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="My Profile" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="mx-auto max-w-3xl space-y-6">
            {/* Profile Header */}
            <Card className="p-6">
              <div className="flex items-start gap-6">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={user.avatarUrl ?? undefined} />
                  <AvatarFallback className="bg-[#002060] text-white text-2xl">
                    {initials}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h1 className="text-2xl font-semibold text-foreground">{displayName}</h1>
                    {user.isContractor && (
                      <Badge className="bg-orange-100 text-orange-800 hover:bg-orange-100">
                        <HardHat className="mr-1 h-3 w-3" />
                        Contractor
                      </Badge>
                    )}
                  </div>

                  {user.jobTitle && (
                    <p className="mt-1 text-muted-foreground">{user.jobTitle.name}</p>
                  )}

                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {user.roles.map(({ role }: { role: { name: string } }) => (
                      <Badge key={role.name} variant="secondary">
                        {ROLE_LABELS[role.name] ?? role.name}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {user.bio && (
                <p className="mt-4 text-sm text-muted-foreground border-t border-border pt-4">
                  {user.bio}
                </p>
              )}
            </Card>

            {/* Details */}
            <Card className="p-6">
              <h2 className="text-base font-semibold text-foreground mb-4">
                Contact &amp; Organization
              </h2>
              <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-center gap-3">
                  <Mail className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Email</dt>
                    <dd className="text-sm text-foreground">{user.email}</dd>
                  </div>
                </div>

                {user.department && (
                  <div className="flex items-center gap-3">
                    <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Department</dt>
                      <dd className="text-sm text-foreground">{user.department.name}</dd>
                    </div>
                  </div>
                )}

                {user.location && (
                  <div className="flex items-center gap-3">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Location</dt>
                      <dd className="text-sm text-foreground">
                        {[user.location.name, user.location.city, user.location.state]
                          .filter(Boolean)
                          .join(", ")}
                      </dd>
                    </div>
                  </div>
                )}

                {user.jobTitle && (
                  <div className="flex items-center gap-3">
                    <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Job Title</dt>
                      <dd className="text-sm text-foreground">{user.jobTitle.name}</dd>
                    </div>
                  </div>
                )}

                {user.hireDate && (
                  <div className="flex items-center gap-3">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div>
                      <dt className="text-xs text-muted-foreground">Hire Date</dt>
                      <dd className="text-sm text-foreground">
                        {new Date(user.hireDate).toLocaleDateString("en-US", {
                          year: "numeric",
                          month: "long",
                          day: "numeric",
                        })}
                      </dd>
                    </div>
                  </div>
                )}

                <div className="flex items-center gap-3">
                  <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div>
                    <dt className="text-xs text-muted-foreground">Member Since</dt>
                    <dd className="text-sm text-foreground">
                      {new Date(user.createdAt).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </dd>
                  </div>
                </div>
              </dl>
            </Card>
          </div>
        </main>
      </div>
    </div>
  );
}
