"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, ClipboardCheck, Home, Menu, ShieldCheck, Table2, Users } from "lucide-react";
import type { LeagueBranding } from "@/modules/branding/domain/league-branding";
import { useAuth } from "@/lib/client-auth";

type BottomTabsProps = {
  leagueId: string;
  branding?: LeagueBranding | null;
  onMore?: () => void;
};

export default function BottomTabs({ leagueId, onMore }: BottomTabsProps) {
  const pathname = usePathname();
  const { user } = useAuth();
  const refereeOnlyNav = user?.role === "REFEREE" && user.leagueId === leagueId;
  const coachOnlyNav =
    user?.role === "COACH" &&
    user.coachAssignments?.some((assignment) => assignment.leagueId === leagueId);
  const tabs = refereeOnlyNav
    ? [
        { key: "referee", path: "/referee", label: "Le mie gare", icon: ShieldCheck },
        { key: "table", path: "/table", label: "Classifica", icon: Table2 },
        { key: "home", path: "", label: "Torneo", icon: Home },
      ]
    : coachOnlyNav
      ? [
          { key: "coach", path: "/coach", label: "Coach", icon: ClipboardCheck },
          { key: "calendar", path: "/calendar", label: "Partite", icon: CalendarDays },
          { key: "table", path: "/table", label: "Classifica", icon: Table2 },
        ]
    : [
        { key: "home", path: "", label: "Home", icon: Home },
        { key: "calendar", path: "/calendar", label: "Calendario", icon: CalendarDays },
        { key: "table", path: "/table", label: "Classifica", icon: Table2 },
        { key: "teams", path: "/teams", label: "Squadre", icon: Users },
      ];

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border-strong)] bg-[var(--tabbar-bg)] lg:hidden">
      <div className={`mx-auto grid max-w-[560px] ${refereeOnlyNav || coachOnlyNav ? "grid-cols-4" : "grid-cols-5"} items-center px-1 py-1`}>
        {tabs.map((tab) => {
          const href = `/leagues/${leagueId}${tab.path}`;
          const active = tab.key === "home" ? pathname === href : pathname.startsWith(href);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex min-w-0 flex-col items-center justify-center gap-0.5 border-t-2 py-2 transition-colors",
                active ? "border-[var(--accent)]" : "border-transparent",
              ].join(" ")}
              style={{ color: active ? "var(--accent)" : "var(--muted)", fontFamily: "var(--font-display, system-ui)" }}
            >
              <span className="px-3 py-1">
                <Icon size={19} strokeWidth={active ? 2.7 : 2} style={{ opacity: active ? 1 : 0.62 }} />
              </span>
              <span className="max-w-full truncate text-[9px]" style={{ fontWeight: active ? 700 : 500 }}>{tab.label}</span>
            </Link>
          );
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex min-w-0 flex-col items-center justify-center gap-0.5 py-2 text-[var(--muted)]"
          aria-label="Apri altre sezioni"
        >
          <span className="px-3 py-1"><Menu size={19} strokeWidth={2} style={{ opacity: 0.62 }} /></span>
          <span className="text-[9px] font-medium">Altro</span>
        </button>
      </div>
      <div className="pb-1" />
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
