"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import {
  BarChart3,
  CalendarDays,
  Handshake,
  Home,
  LogOut,
  Search,
  Settings,
  ShieldCheck,
  Swords,
  Table2,
  Trophy,
  Users,
  X,
  Youtube,
  Camera,
  UploadCloud,
} from "lucide-react";
import { clearAuthToken, useAuth, useCanAdminLeague, useCanCreateMedia, useIsSuperAdmin } from "@/lib/client-auth";
import { resolveLeagueBranding, type LeagueBranding } from "@/modules/branding/domain/league-branding";

type MobileMenuProps = {
  leagueId?: string;
  open: boolean;
  onClose: () => void;
  branding?: LeagueBranding | null;
};

function MenuLink({
  href,
  label,
  icon,
  active,
  onClick,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex min-h-12 items-center gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors",
        active
          ? "border-[var(--border-strong)] bg-[var(--accent-soft)] font-bold text-[var(--accent)]"
          : "border-[var(--border)] bg-[var(--card-2)] font-semibold text-[var(--foreground)]/75",
      ].join(" ")}
    >
      <span className="shrink-0 opacity-80">{icon}</span>
      <span>{label}</span>
    </Link>
  );
}

export default function MobileMenu({ leagueId, open, onClose, branding }: MobileMenuProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, refresh } = useAuth();
  const isAdmin = useCanAdminLeague(leagueId);
  const canCreateMedia = useCanCreateMedia(leagueId);
  const isSuperAdmin = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const hasPlayoffs = Boolean(branding?.playoffFormat);
  const resolvedBrand = resolveLeagueBranding(branding);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, onClose]);


  useEffect(() => {
    onClose();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname]);

  if (!open) return null;

  const tournamentLinks = leagueId
    ? [
        { href: `/leagues/${leagueId}`, label: "Home", icon: <Home size={18} /> },
        { href: `/leagues/${leagueId}/table`, label: "Classifica", icon: <Table2 size={18} /> },
        { href: `/leagues/${leagueId}/calendar`, label: "Calendario", icon: <CalendarDays size={18} /> },
        ...(hasPlayoffs
          ? [{ href: `/leagues/${leagueId}/playoffs`, label: "Playoff", icon: <Swords size={18} /> }]
          : []),
        { href: `/leagues/${leagueId}/teams`, label: "Squadre", icon: <Trophy size={18} /> },
        { href: `/leagues/${leagueId}/players`, label: "Giocatori", icon: <Users size={18} /> },
        { href: `/leagues/${leagueId}/stats`, label: "Statistiche", icon: <BarChart3 size={18} /> },
        { href: `/leagues/${leagueId}/sponsors`, label: "Sponsor", icon: <Handshake size={18} /> },
        { href: `/leagues/${leagueId}/media`, label: "Media", icon: <Camera size={18} /> },
        { href: `/leagues/${leagueId}/videos`, label: "Video", icon: <Youtube size={18} /> },
      ]
    : [];

  function submitSearch(event: FormEvent) {
    event.preventDefault();
    if (!leagueId) return;
    const query = search.trim();
    onClose();
    router.push(
      query
        ? `/leagues/${leagueId}/players?q=${encodeURIComponent(query)}`
        : `/leagues/${leagueId}/players`
    );
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    clearAuthToken();
    await refresh();
    onClose();
    router.push("/");
  }

  return (
    <div className="no-print fixed inset-0 z-[80] lg:hidden" role="dialog" aria-modal="true" aria-label="Menu mobile">
      <button
        type="button"
        aria-label="Chiudi menu"
        onClick={onClose}
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
      />

      <div className="absolute inset-y-0 right-0 flex w-[min(92vw,390px)] flex-col border-l border-[var(--border)] bg-[var(--card)] shadow-2xl">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-5 py-4">
          <div className="flex min-w-0 items-center gap-3">
            {branding && resolvedBrand.logoUrl && <img src={resolvedBrand.logoUrl} alt="" loading="eager" decoding="async" className="h-9 w-9 shrink-0 rounded-lg object-contain" />}
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[var(--accent)]">Navigazione</p>
              <p className="mt-1 truncate text-sm font-semibold text-[var(--foreground)]">
                {branding?.name || (user ? user.username : "Tornei")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Chiudi"
            className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl border border-[var(--border)] text-[var(--muted)]"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {leagueId && (
            <form onSubmit={submitSearch} className="mb-5">
              <label className="mb-2 block text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">
                Cerca giocatore
              </label>
              <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] p-1.5 pl-3">
                <Search size={17} className="shrink-0 text-[var(--muted)]" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nome o cognome…"
                  className="min-w-0 flex-1 bg-transparent py-2 text-base text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
                />
                <button
                  type="submit"
                  className="min-h-10 rounded-xl bg-[var(--accent)] px-4 text-xs font-black text-black"
                >
                  Cerca
                </button>
              </div>
            </form>
          )}

          {tournamentLinks.length > 0 && (
            <section>
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--muted)]">Torneo</p>
              <div className="grid gap-2 sm:grid-cols-2">
                {tournamentLinks.map((item) => (
                  <MenuLink
                    key={item.href}
                    {...item}
                    active={pathname === item.href || (item.href !== `/leagues/${leagueId}` && pathname.startsWith(`${item.href}/`))}
                    onClick={onClose}
                  />
                ))}
              </div>
            </section>
          )}

          {leagueId && user?.role === "REFEREE" && user.leagueId === leagueId && (
            <section className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Arbitro</p>
              <MenuLink
                href={`/leagues/${leagueId}/my-match`}
                label="La mia partita"
                icon={<ShieldCheck size={18} />}
                active={pathname === `/leagues/${leagueId}/my-match`}
                onClick={onClose}
              />
            </section>
          )}

          {canCreateMedia && (
            <section className="mt-6 border-t border-[var(--border)] pt-5">
              <p className="mb-2 px-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Creator</p>
              <MenuLink
                href={`/leagues/${leagueId}/creator`}
                label={user?.role === "CREATOR" ? "Creator Studio" : "Carica media"}
                icon={<UploadCloud size={18} />}
                active={pathname === `/leagues/${leagueId}/creator`}
                onClick={onClose}
              />
            </section>
          )}

          {isAdmin && (
            <section className="mt-6 border-t border-[var(--border)] pt-5">
              <div className="mb-3 flex items-center gap-2 px-1">
                <ShieldCheck size={15} className="text-[var(--accent)]" />
                <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[var(--accent)]">Amministrazione</p>
              </div>
              <div className="grid gap-2">
                {leagueId && (
                  <MenuLink
                    href={`/leagues/${leagueId}/admin`}
                    label="Impostazioni torneo"
                    icon={<Settings size={18} />}
                    active={pathname === `/leagues/${leagueId}/admin`}
                    onClick={onClose}
                  />
                )}
                {isSuperAdmin && (
                  <MenuLink
                    href="/admin/users"
                    label="Gestione utenti"
                    icon={<ShieldCheck size={18} />}
                    active={pathname === "/admin/users"}
                    onClick={onClose}
                  />
                )}
              </div>
            </section>
          )}
        </div>

        {user && (
          <div className="border-t border-[var(--border)] p-4" style={{ paddingBottom: "max(1rem, env(safe-area-inset-bottom))" }}>
            <button
              type="button"
              onClick={logout}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl border border-red-400/20 bg-red-500/10 px-4 text-sm font-bold text-red-300"
            >
              <LogOut size={17} />
              Esci dall'account
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
