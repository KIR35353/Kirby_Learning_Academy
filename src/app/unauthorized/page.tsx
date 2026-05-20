import Link from "next/link";
import { ShieldX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = { title: "Unauthorized" };

export default function UnauthorizedPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center space-y-4">
        <ShieldX className="mx-auto h-16 w-16 text-muted-foreground" />
        <h1 className="text-2xl font-semibold text-foreground">Access Denied</h1>
        <p className="text-muted-foreground">
          You don&apos;t have permission to view this page.
        </p>
        <Button
          className="bg-[#002060] text-white hover:bg-[#001245]"
          render={<Link href="/" />}
        >
          Go to Dashboard
        </Button>
      </div>
    </div>
  );
}
