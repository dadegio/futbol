"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Table2, CalendarDays, Users, Trophy, BarChart3 } from "lucide-react";

type BottomTabsProps = {
  leagueId: string;
};

const TABS = [
  { key: "home", path: "", label: "Home", icon: Home },
  { key: "table", path: "/table", label: "Tab.", icon: Table2 },
  { key: "calendar", path: "/calendar", label: "Cal.", icon: CalendarDays },
  { key: "playoffs", path: "/playoffs", label: "Playoff", icon: Trophy },
  { key: "stats", path: "/stats", label: "Stats", icon: BarChart3 },
  { key: "teams", path: "/teams", label: "Sqd.", icon: Users },
];

export default function BottomTabs({ leagueId }: BottomTabsProps) {
  const pathname = usePathname();

  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-50 lg:hidden"
      style={{ background: "var(--tabbar-bg)", borderTop: "1px solid var(--border)" }}
    >
      <div className="mx-auto flex max-w-[480px] items-center justify-around px-0 py-1">
        {TABS.map((tab) => {
          const href = `/leagues/${leagueId}${tab.path}`;
          const active =
            tab.key === "home"
              ? pathname === href
              : pathname.startsWith(href);
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
              <Icon
                size={20}
                strokeWidth={active ? 2.5 : 2}
                style={{ opacity: active ? 1 : 0.6 }}
              />
              <span
                className="text-[9px]"
                style={{ fontWeight: active ? 600 : 400 }}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
      <div className="flex justify-center pb-1.5 pt-0.5">
        <div
          className="h-1 w-10 rounded-full"
          style={{ background: "var(--border-strong)" }}
        />
      </div>
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
