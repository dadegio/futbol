"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  Home,
  Trophy,
  CalendarDays,
  Users,
  BarChart3,
  Search,
  Swords,
  ShieldCheck,
  Settings,
  Handshake,
  Youtube,
  Camera,
  UploadCloud,
  Whistle,
} from "lucide-react";
import AuthButton from "./auth-button";
import { useAuth, useCanAdminLeague, useCanCreateMedia, useIsSuperAdmin } from "@/lib/client-auth";
import { resolveLeagueBranding, type LeagueBranding } from "@/modules/branding/domain/league-branding";

type SidebarProps = {
  leagueId?: string;
  branding?: LeagueBranding | null;
};

function NavItem({
  href,
  icon,
  label,
  active = false,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          ? "border border-[var(--border-strong)] bg-[var(--accent-soft)] font-bold text-[var(--accent)]"
          : "border border-transparent font-normal text-[var(--muted)] hover:border-[var(--border)] hover:bg-[var(--card-2)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      <span className={active ? "opacity-100" : "opacity-60"}>{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar({ leagueId, branding }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = useCanAdminLeague(leagueId);
  const canCreateMedia = useCanCreateMedia(leagueId);
  const isSuperAdmin = useIsSuperAdmin();
  const [search, setSearch] = useState("");
  const [leagueName, setLeagueName] = useState<string | null>(null);
  const hasPlayoffs = Boolean(branding?.playoffFormat);
  const resolvedBrand = resolveLeagueBranding(branding);

  useEffect(() => {
    if (branding?.name) setLeagueName(branding.name);
  }, [branding?.name]);


  const links = leagueId
    ? [
        { href: `/leagues/${leagueId}`,           label: "Overview",    icon: <Home size={17} /> },
        { href: `/leagues/${leagueId}/table`,      label: "Classifica",  icon: <Trophy size={17} /> },
        { href: `/leagues/${leagueId}/calendar`,   label: "Calendario",  icon: <CalendarDays size={17} /> },
        ...(hasPlayoffs ? [{ href: `/leagues/${leagueId}/playoffs`, label: "Playoff", icon: <Swords size={17} /> }] : []),
        { href: `/leagues/${leagueId}/teams`,      label: "Squadre",     icon: <Users size={17} /> },
        { href: `/leagues/${leagueId}/players`,    label: "Giocatori",   icon: <Users size={17} /> },
        { href: `/leagues/${leagueId}/stats`,      label: "Statistiche", icon: <BarChart3 size={17} /> },
        { href: `/leagues/${leagueId}/sponsors`,   label: "Sponsor",     icon: <Handshake size={17} /> },
        { href: `/leagues/${leagueId}/media`,      label: "Media",       icon: <Camera size={17} /> },
        { href: `/leagues/${leagueId}/videos`,     label: "Video",       icon: <Youtube size={17} /> },
      ]
    : [{ href: `/`, label: "Home", icon: <Home size={17} /> }];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueId) return;
    const q = search.trim();
    router.push(q
      ? `/leagues/${leagueId}/players?q=${encodeURIComponent(q)}`
      : `/leagues/${leagueId}/players`
    );
  }

  return (
    <aside className="turf-card hidden w-[260px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:block">
      {/* Identità del torneo */}
      <div className="mb-5">
        <Link href="/" className="flex items-center gap-3">
          {resolvedBrand.logoUrl ? (
            <img
              src={resolvedBrand.logoUrl}
              alt=""
              loading="eager"
              decoding="async"
              className="h-12 w-12 shrink-0 rounded-xl object-contain"
            />
          ) : (
            <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl border border-[var(--border)] bg-[var(--accent-soft)] text-lg font-black text-[var(--accent)]">
              {(leagueName || "T").slice(0, 1).toUpperCase()}
            </div>
          )}
          {resolvedBrand.mode === "IMPERIAL" ? (
            <span className="imperial-title leading-none text-[22px] font-bold tracking-[0.08em] text-[var(--accent)]">
              CAMMINO<br />IMPERIALE
            </span>
          ) : (
            <span className="min-w-0 text-[18px] font-black leading-tight tracking-[-0.03em] text-[var(--accent)]">
              <span className="block line-clamp-2">{leagueName || "Torneo"}</span>
            </span>
          )}
        </Link>
      </div>

      {/* League name */}
      {leagueId && leagueName && (
        <div className="imperial-plate mb-4 rounded-xl px-3 py-2.5">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/35">
            Torneo attivo
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-[var(--foreground)]">
            {leagueName}
          </p>
        </div>
      )}

      {/* Search */}
      <form
        onSubmit={submitSearch}
        className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-2"
      >
        <Search size={14} className="shrink-0 text-[var(--foreground)]/40" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={leagueId ? "Cerca giocatore…" : "Cerca…"}
          className="min-w-0 flex-1 bg-transparent text-sm text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/35"
        />
        {leagueId && (
          <button
            type="submit"
            className="rounded-lg border border-[var(--border-strong)] bg-[var(--imperial-green-2)] px-2.5 py-1 text-xs font-semibold text-[var(--imperial-text)]"
          >
            Vai
          </button>
        )}
      </form>

      {/* Nav */}
      <nav aria-label="Navigazione principale" className="space-y-0.5">
        {links.map((item) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {leagueId && user?.role === "REFEREE" && user.leagueId === leagueId && (
        <>
          <div className="my-3 border-t border-[var(--border)]" />
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/30">Arbitro</p>
          <NavItem
            href={`/leagues/${leagueId}/my-match`}
            icon={<Whistle size={17} />}
            label="La mia partita"
            active={pathname === `/leagues/${leagueId}/my-match`}
          />
        </>
      )}

      {/* Creator section */}
      {canCreateMedia && (
        <>
          <div className="my-3 border-t border-[var(--border)]" />
          <NavItem
            href={`/leagues/${leagueId}/creator`}
            icon={<UploadCloud size={17} />}
            label={user?.role === "CREATOR" ? "Creator Studio" : "Carica media"}
            active={pathname === `/leagues/${leagueId}/creator`}
          />
        </>
      )}

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className="my-3 border-t border-[var(--border)]" />
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/30">
            Admin
          </p>
          {leagueId && (
            <NavItem
              href={`/leagues/${leagueId}/admin`}
              icon={<Settings size={17} />}
              label="Impostazioni"
              active={pathname === `/leagues/${leagueId}/admin`}
            />
          )}
          {isSuperAdmin && (
            <NavItem
              href="/admin/users"
              icon={<ShieldCheck size={17} />}
              label="Utenti"
              active={pathname === "/admin/users"}
            />
          )}
        </>
      )}

      {/* Bottom */}
      <div className="mt-5 border-t border-[var(--border)] pt-4">
        <AuthButton />
      </div>
    </aside>
  );
}
