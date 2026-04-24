"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, UserCircle } from "lucide-react";
import Sidebar from "./sidebar";
import BottomTabs from "./bottom-tabs";
import Breadcrumbs from "./breadcrumbs";
import { useAuth, clearAuthToken } from "@/lib/client-auth";

export default function DashboardShell({
  children,
  leagueId,
}: {
  children: React.ReactNode;
  leagueId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  function handleLogout() {
    clearAuthToken();
    router.refresh();
  }

  // Restore saved accent color on mount
  useEffect(() => {
    const saved = localStorage.getItem("futbol-accent");
    if (saved) {
      document.documentElement.setAttribute("data-accent", saved);
    }
  }, []);

  return (
    <div className="min-h-screen px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:p-7">
      <div className="mx-auto max-w-[1600px]">
        {/* Mobile top bar */}
        <div className="no-print mb-4 flex items-center justify-between rounded-[22px] border border-[var(--border)] bg-[var(--card)]/95 px-4 py-3 shadow-xl shadow-black/10 lg:hidden">
          <Link href="/" className="text-lg font-extrabold tracking-tight">
            <span className="text-[var(--accent)] italic">FUTBOL</span>
          </Link>

          {!authLoading && (
            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <span className="flex items-center gap-1.5 text-xs text-[var(--foreground)]/60">
                    <UserCircle size={15} />
                    {user.username}
                  </span>
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1 rounded-xl border border-[var(--border)] px-2.5 py-1.5 text-xs text-[var(--foreground)]/60 transition-colors hover:text-[var(--foreground)]"
                  >
                    <LogOut size={13} />
                    Esci
                  </button>
                </>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-xl bg-[var(--accent)] px-3 py-1.5 text-xs font-semibold text-black transition-colors hover:bg-[var(--accent-2)]"
                >
                  <LogIn size={13} />
                  Accedi
                </Link>
              )}
            </div>
          )}
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
