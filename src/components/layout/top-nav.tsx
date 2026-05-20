"use client";

import { Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// ── Props ──────────────────────────────────────────────────────────────────
type TopNavProps = {
  pageTitle?: string;
  /** Injected by the auth session in Phase 2 */
  user?: {
    name: string;
    email: string;
    avatarUrl?: string;
    initials: string;
  };
  notificationCount?: number;
};

// ── Component ──────────────────────────────────────────────────────────────
export function TopNav({
  pageTitle,
  user = { name: "Demo User", email: "demo@kirbycorp.com", initials: "DU" },
  notificationCount = 0,
}: TopNavProps) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-white px-6 shadow-sm">
      {/* page title */}
      <h1 className="truncate text-base font-semibold text-k-navy">
        {pageTitle ?? "Kirby Learning Academy"}
      </h1>

      <div className="flex items-center gap-3">
        {/* notification bell */}
        <button
          className="relative rounded-md p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-k-navy"
          aria-label="Notifications"
        >
          <Bell className="h-5 w-5" />
          {notificationCount > 0 && (
            <Badge className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center bg-k-orange p-0 text-[9px] text-white">
              {notificationCount > 99 ? "99+" : notificationCount}
            </Badge>
          )}
        </button>

        {/* user menu */}
        <DropdownMenu>
          <DropdownMenuTrigger className="flex items-center gap-2 rounded-md px-2 py-1.5 transition-colors hover:bg-accent">
            <Avatar className="h-7 w-7">
              {user.avatarUrl && (
                <AvatarImage src={user.avatarUrl} alt={user.name} />
              )}
              <AvatarFallback className="bg-k-navy text-[11px] font-bold text-white">
                {user.initials}
              </AvatarFallback>
            </Avatar>
            <span className="hidden max-w-36 truncate text-sm font-medium text-foreground sm:block">
              {user.name}
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          </DropdownMenuTrigger>

          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuLabel className="font-normal">
              <p className="font-semibold">{user.name}</p>
              <p className="text-xs text-muted-foreground">{user.email}</p>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem>
              <User className="mr-2 h-4 w-4" /> My Profile
            </DropdownMenuItem>
            <DropdownMenuItem>
              <Settings className="mr-2 h-4 w-4" /> Account Settings
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:text-destructive">
              <LogOut className="mr-2 h-4 w-4" /> Sign Out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
