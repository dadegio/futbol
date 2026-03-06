"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu } from "lucide-react";
import Sidebar from "./sidebar";

export default function DashboardShell({
  children,
  leagueId,
}: {
  children: React.ReactNode;
  leagueId?: string;
}) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:p-7">
      <div className="mx-auto max-w-[1600px]">
        <div className="mb-4 flex items-center justify-between rounded-[22px] border border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 shadow-xl shadow-black/10 lg:hidden">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-[var(--accent)] italic">FUTBOL</span>
          </Link>

          <button
            onClick={() => setMobileMenuOpen(true)}
            className="rounded-xl border border-[var(--border)] bg-white/5 p-2 text-[var(--foreground)]/80"
            aria-label="Apri menu"
          >
            <Menu size={20} />
          </button>
        </div>

        {mobileMenuOpen ? (
          <div className="fixed inset-0 z-50 bg-black/55 p-3 backdrop-blur-sm lg:hidden">
            <div className="h-full overflow-y-auto rounded-[28px]">
              <Sidebar
                leagueId={leagueId}
                mobile
                onNavigate={() => setMobileMenuOpen(false)}
              />
            </div>
          </div>
        ) : null}

        <div className="flex gap-4 md:gap-6">
          <Sidebar leagueId={leagueId} />
          <main className="min-w-0 flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}