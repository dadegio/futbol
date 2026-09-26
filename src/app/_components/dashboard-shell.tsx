"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { LogIn, Menu, UserCircle } from "lucide-react";
import Sidebar from "./sidebar";
import BottomTabs from "./bottom-tabs";
import MobileMenu from "./mobile-menu";
import Breadcrumbs from "./breadcrumbs";
import { useAuth } from "@/lib/client-auth";
import LeagueThemeController from "./league-theme-controller";
import { resolveLeagueBranding, type LeagueBranding } from "@/modules/branding/domain/league-branding";
import { cachedJson } from "@/modules/core/client-cache";

export default function DashboardShell({
  children,
  leagueId,
}: {
  children: React.ReactNode;
  leagueId?: string;
}) {
  const { user, loading: authLoading } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [leagueBrand, setLeagueBrand] = useState<LeagueBranding | null>(null);

  useEffect(() => {
    if (!leagueId) {
      setLeagueBrand(null);
      return;
    }

    let cancelled = false;
    const loadBranding = () => {
      cachedJson<LeagueBranding>(`/api/leagues/${leagueId}`, {
        ttlMs: 30_000,
        fallbackMessage: "Errore caricamento torneo",
      })
        .then((data) => {
          if (!cancelled && data?.id) {
            setLeagueBrand(data);
            window.dispatchEvent(new CustomEvent("league-branding-updated", { detail: data }));
          }
        })
        .catch(() => {});
    };

    loadBranding();
    const handleUpdate = (event: Event) => {
      const detail = (event as CustomEvent<LeagueBranding>).detail;
      if (detail?.id === leagueId) setLeagueBrand(detail);
      else loadBranding();
    };
    window.addEventListener("league-branding-updated", handleUpdate);
    return () => {
      cancelled = true;
      window.removeEventListener("league-branding-updated", handleUpdate);
    };
  }, [leagueId]);

  const resolvedBrand = resolveLeagueBranding(leagueBrand);
  const creatorOnlyNav = Boolean(
    leagueId && user?.role === "CREATOR" && user.leagueId === leagueId
  );

return (
    <div className="min-h-screen max-w-full overflow-x-hidden px-3 py-3 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-7 lg:py-7 xl:px-9 2xl:px-12">
      <LeagueThemeController league={leagueBrand} />
      <div className="w-full min-w-0">
        {/* Mobile top bar */}
        <div className="no-print mb-4 flex min-w-0 items-center justify-between gap-3 rounded-[18px] bg-[var(--card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)] lg:hidden">
          <Link href="/" className="flex min-w-0 items-center gap-2.5 text-base font-extrabold tracking-tight sm:text-lg">
            {leagueBrand && resolvedBrand.logoUrl && (
              <img src={resolvedBrand.logoUrl} alt="" loading="eager" decoding="async" className="h-8 w-8 shrink-0 object-contain" />
            )}
            <span className="block truncate font-black text-[var(--accent)]">{resolvedBrand.mode === "IMPERIAL" ? "FUTPOLI" : (leagueBrand?.name || "TORNEI")}</span>
          </Link>

          {!authLoading && (
            <div className="flex shrink-0 items-center gap-2">
              {user ? (
                <span className="hidden items-center gap-1.5 text-xs text-[var(--foreground)]/60 min-[380px]:flex">
                  <UserCircle size={15} />
                  <span className="max-w-24 truncate">{user.username}</span>
                </span>
              ) : (
                <Link
                  href="/login"
                  className="flex items-center gap-1.5 rounded-xl border border-[var(--border-strong)] bg-[var(--imperial-green-2)] px-3 py-1.5 text-xs font-semibold text-[var(--imperial-text)] transition-colors hover:bg-[var(--imperial-green)]"
                >
                  <LogIn size={13} />
                  Accedi
                </Link>
              )}
              <button
                type="button"
                onClick={() => setMobileMenuOpen(true)}
                aria-label="Apri menu"
                className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--card-2)] text-[var(--foreground)]/70"
              >
                <Menu size={19} />
              </button>
            </div>
          )}
        </div>

        <div className="flex w-full min-w-0 gap-4 md:gap-6">
          <Sidebar leagueId={leagueId} branding={leagueBrand} />

          <main className="min-w-0 flex-1 pb-20 lg:pb-0">
            <Breadcrumbs leagueId={leagueId} />
            {children}
          </main>
        </div>
      </div>

      {/* Mobile bottom tab bar */}
      {leagueId && !creatorOnlyNav && <BottomTabs leagueId={leagueId} branding={leagueBrand} onMore={() => setMobileMenuOpen(true)} />}

      <MobileMenu
        leagueId={leagueId}
        open={mobileMenuOpen}
        onClose={() => setMobileMenuOpen(false)}
        branding={leagueBrand}
      />

    </div>
  );
}
