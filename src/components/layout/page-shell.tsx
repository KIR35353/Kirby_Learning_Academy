import { cn } from "@/lib/utils";

type PageShellProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * Wraps the main content area of every authenticated page.
 * Provides consistent padding and scroll behaviour.
 */
export function PageShell({ children, className }: PageShellProps) {
  return (
    <main
      className={cn(
        "flex-1 overflow-y-auto bg-background p-6 md:p-8",
        className,
      )}
    >
      {children}
    </main>
  );
}
