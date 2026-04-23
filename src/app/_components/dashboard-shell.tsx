"use client";

import Link from "next/link";
import Sidebar from "./sidebar";
import BottomTabs from "./bottom-tabs";
import Breadcrumbs from "./breadcrumbs";

export default function DashboardShell({
  children,
  leagueId,
}: {
  children: React.ReactNode;
  leagueId?: string;
}) {
  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:p-7">
      <div className="mx-auto max-w-[1600px]">
        {/* Mobile top bar — logo only, no hamburger needed with bottom tabs */}
        <div className="mb-4 flex items-center rounded-[22px] border border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 shadow-xl shadow-black/10 lg:hidden">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-[var(--accent)] italic">FUTBOL</span>
          </Link>
        </div>

        <div className="flex gap-4 md:gap-6">
          <Sidebar leagueId={leagueId} />

          <main className="min-w-0 flex-1 pb-20 lg:pb-0">
            <Breadcrumbs leagueId={leagueId} />
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {leagueId && <BottomTabs leagueId={leagueId} />}
    </div>
  );
}
