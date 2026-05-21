import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Sidebar, TopNav } from "@/components/layout";
import { CatalogClient } from "./_components/catalog-client";

export const metadata = { title: "Course Catalog — Kirby Learning Academy" };

export default async function CatalogPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <TopNav pageTitle="Course Catalog" />
        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <CatalogClient />
        </main>
      </div>
    </div>
  );
}
