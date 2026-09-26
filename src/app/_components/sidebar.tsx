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
  ClipboardCheck,
  UploadCloud,
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
  index,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  index?: number;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={[
        "group flex items-center gap-3 border-l-2 px-3 py-2.5 text-sm transition-colors",
        active
          ? "border-[var(--accent)] bg-transparent font-semibold text-[var(--foreground)]"
          : "border-transparent font-normal text-[var(--muted)] hover:border-[var(--border-strong)] hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      {typeof index === "number" ? (
        <span className="w-5 shrink-0 font-mono text-[10px] tracking-[0.08em] text-[var(--foreground)]/32">
          {String(index + 1).padStart(2, "0")}
        </span>
      ) : (
        <span className={active ? "w-5 shrink-0 text-[var(--accent)]" : "w-5 shrink-0 opacity-45"}>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{label}</span>
      {typeof index === "number" && (
        <span className={active ? "text-[var(--accent)]" : "opacity-25 transition-opacity group-hover:opacity-55"}>
          {icon}
        </span>
      )}
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
  const creatorOnlyNav = Boolean(
    leagueId && user?.role === "CREATOR" && user.leagueId === leagueId
  );
  const refereeOnlyNav = Boolean(
    leagueId && user?.role === "REFEREE" && user.leagueId === leagueId
  );
  const coachOnlyNav = Boolean(
    leagueId &&
      user?.role === "COACH" &&
      user.coachAssignments?.some((assignment) => assignment.leagueId === leagueId)
  );

  useEffect(() => {
    if (branding?.name) setLeagueName(branding.name);
  }, [branding?.name]);


  const links = creatorOnlyNav
    ? [
        { href: `/leagues/${leagueId}/creator`, label: "I miei incarichi", icon: <Camera size={17} /> },
        { href: `/leagues/${leagueId}/creator/profile`, label: "Il mio profilo", icon: <Settings size={17} /> },
      ]
    : refereeOnlyNav
      ? [
          { href: `/leagues/${leagueId}/referee`, label: "Il mio calendario", icon: <ShieldCheck size={17} /> },
          { href: `/leagues/${leagueId}/table`, label: "Classifica", icon: <Trophy size={17} /> },
        ]
    : coachOnlyNav
      ? [
          { href: `/leagues/${leagueId}/coach`, label: "Coach Center", icon: <ClipboardCheck size={17} /> },
          { href: `/leagues/${leagueId}/calendar`, label: "Partite", icon: <CalendarDays size={17} /> },
          { href: `/leagues/${leagueId}/table`, label: "Classifica", icon: <Trophy size={17} /> },
        ]
    : leagueId
    ? [
        { href: `/leagues/${leagueId}`,           label: "Home",    icon: <Home size={17} /> },
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
    <aside className="hidden w-[236px] shrink-0 border-r border-[var(--border)] pr-5 lg:flex lg:min-h-[calc(100vh-3.5rem)] lg:flex-col">
      {/* Identità del torneo */}
      <div className="mb-5 border-b border-[var(--border)] pb-5">
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
            <span className="scoreboard-figure leading-none text-[22px] text-[var(--accent)]">
              FUTPOLI
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
        <div className="mb-5 border-b border-[var(--border)] pb-4">
          <p className="text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/35">
            Torneo attivo
          </p>
          <p className="mt-0.5 truncate text-sm font-medium text-[var(--foreground)]">
            {leagueName}
          </p>
        </div>
      )}

      {/* Search */}
      {!creatorOnlyNav && !refereeOnlyNav && !coachOnlyNav && <form
        onSubmit={submitSearch}
        className="mb-5 flex items-center gap-2 border-b border-[var(--border)] px-1 py-2.5"
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
            className="border-l border-[var(--border-strong)] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--accent)]"
          >
            Vai
          </button>
        )}
      </form>}

      {/* Nav */}
      <nav aria-label="Navigazione principale" className="space-y-0.5">
        {links.map((item, index) => (
          <NavItem
            key={item.href}
            href={item.href}
            icon={item.icon}
            label={item.label}
            index={index}
            active={pathname === item.href}
          />
        ))}
      </nav>

      {/* Creator section */}
      {canCreateMedia && !creatorOnlyNav && (
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
              href={leagueId ? `/admin/users?leagueId=${encodeURIComponent(leagueId)}` : "/admin/users"}
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
