"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Table2, CalendarDays, Users, BarChart3 } from "lucide-react";

type BottomTabsProps = {
  leagueId: string;
};

const TABS = [
  { key: "home", path: "", label: "Home", icon: Home },
  { key: "table", path: "/table", label: "Tab.", icon: Table2 },
  { key: "calendar", path: "/calendar", label: "Cal.", icon: CalendarDays },
  { key: "stats", path: "/stats", label: "Stats", icon: BarChart3 },
  { key: "teams", path: "/teams", label: "Squadre", icon: Users },
];

export default function BottomTabs({ leagueId }: BottomTabsProps) {
  const pathname = usePathname();

  return (
    <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[var(--card)]/95 backdrop-blur-xl lg:hidden">
      <div className="mx-auto flex max-w-lg items-stretch justify-around">
        {TABS.map((tab) => {
          const href = `/leagues/${leagueId}${tab.path}`;
          const active =
            tab.key === "home"
              ? pathname === href
              : pathname.startsWith(href);
          const Icon = tab.icon;

          return (
            <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-[var(--border)] bg-[#fbfaf7]/90 backdrop-blur-xl lg:hidden">
              <div className="mx-auto flex max-w-[480px] items-center justify-around px-2 pt-2">
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
                      className={[
                        "flex flex-1 flex-col items-center gap-1 py-2 text-[11px] font-medium transition",
                        active
                          ? "text-[var(--accent)]"
                          : "text-[#aaa9a3] active:text-[var(--foreground)]",
                      ].join(" ")}
                    >
                      <Icon size={24} strokeWidth={active ? 2.5 : 2} />
                      <span>{tab.label}</span>
                    </Link>
                  );
                })}
              </div>

              <div className="mx-auto mb-2 mt-1 h-1 w-20 rounded-full bg-black/15" />
              <div className="h-[env(safe-area-inset-bottom)]" />
            </nav>
          );
        })}
      </div>

      {/* Safe area spacer for notched devices */}
      <div className="h-[env(safe-area-inset-bottom)]" />
    </nav>
  );
}
