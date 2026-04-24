"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Home,
  Trophy,
  CalendarDays,
  Swords,
  Users,
  BarChart3,
} from "lucide-react";

type BottomTabsProps = {
  leagueId: string;
};

const TABS = [
  { key: "overview", path: "", label: "Home", icon: Home },
  { key: "table", path: "/table", label: "Classifica", icon: Trophy },
  { key: "calendar", path: "/calendar", label: "Calendario", icon: CalendarDays },
  { key: "playoffs", path: "/playoffs", label: "Playoff", icon: Swords },
  { key: "teams", path: "/teams", label: "Squadre", icon: Users },
  { key: "stats", path: "/stats", label: "Stats", icon: BarChart3 },
];

export default function BottomTabs({ leagueId }: BottomTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const href = `/leagues/${leagueId}${tab.path}`;
          const active =
            tab.path === ""
              ? pathname === href
              : pathname.startsWith(href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.key}
              href={href}
              aria-current={active ? "page" : undefined}
              className={[
                "flex flex-1 flex-col items-center gap-0.5 py-3 text-[10px] font-medium transition",
                active
                  ? "text-[var(--accent)]"
                  : "text-[var(--foreground)]/45 active:text-[var(--foreground)]/70",
              ].join(" ")}
            >
              <Icon size={20} strokeWidth={active ? 2.5 : 2} />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Safe area spacer for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
