"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { Home, Table2, CalendarDays, Users, Trophy, BarChart3, Camera } from "lucide-react";
import type { LeagueBranding } from "@/modules/branding/domain/league-branding";

type BottomTabsProps = {
  leagueId: string;
  branding?: LeagueBranding | null;
};

export default function BottomTabs({ leagueId, branding }: BottomTabsProps) {
  const pathname = usePathname();
  const hasPlayoffs = Boolean(branding?.playoffFormat);

  const tabs = useMemo(
    () => [
      { key: "home", path: "", label: "Home", icon: Home },
      { key: "table", path: "/table", label: "Tab.", icon: Table2 },
      { key: "calendar", path: "/calendar", label: "Cal.", icon: CalendarDays },
      { key: "media", path: "/media", label: "Media", icon: Camera },
      ...(hasPlayoffs ? [{ key: "playoffs", path: "/playoffs", label: "Playoff", icon: Trophy }] : []),
      { key: "stats", path: "/stats", label: "Stats", icon: BarChart3 },
      { key: "teams", path: "/teams", label: "Sqd.", icon: Users },
    ],
    [hasPlayoffs]
  );

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--tabbar-bg)] backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-[520px] items-center justify-around px-1 py-1">
        {tabs.map((tab) => {
          const href = `/leagues/${leagueId}${tab.path}`;
          const active = tab.key === "home" ? pathname === href : pathname.startsWith(href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className="flex flex-1 flex-col items-center justify-center gap-0.5 py-2"
              style={{
                color: active ? "var(--accent)" : "var(--muted)",
                fontFamily: "var(--font-display, system-ui)",
              }}
            >
              <span className={active ? "rounded-full bg-[var(--accent-soft)] px-3 py-1" : "px-3 py-1"}>
                <Icon size={19} strokeWidth={active ? 2.7 : 2} style={{ opacity: active ? 1 : 0.62 }} />
              </span>
              <span className="text-[9px]" style={{ fontWeight: active ? 700 : 500 }}>
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="flex justify-center pb-1.5 pt-0.5">
        <div className="h-1 w-10 rounded-full bg-[var(--border-strong)]" />
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
