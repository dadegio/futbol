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
} from "lucide-react";
import ThemePicker from "./theme-picker";
import AuthButton from "./auth-button";
import { useIsAdmin } from "@/lib/client-auth";

type SidebarProps = {
  leagueId?: string;
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
      className={[
        "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
        active
          ? "bg-[var(--card-2)] font-medium text-[var(--accent)]"
          : "font-normal text-[var(--foreground)]/60 hover:bg-white/5 hover:text-[var(--foreground)]/90",
      ].join(" ")}
    >
      <span className={active ? "opacity-100" : "opacity-60"}>{icon}</span>
      {label}
    </Link>
  );
}

export default function Sidebar({ leagueId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const isAdmin = useIsAdmin();
  const [search, setSearch] = useState("");
  const [leagueName, setLeagueName] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    fetch(`/api/leagues/${leagueId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => { if (d?.name) setLeagueName(d.name); })
      .catch(() => {});
  }, [leagueId]);

  const links = leagueId
    ? [
        { href: `/leagues/${leagueId}`,           label: "Overview",    icon: <Home size={17} /> },
        { href: `/leagues/${leagueId}/table`,      label: "Classifica",  icon: <Trophy size={17} /> },
        { href: `/leagues/${leagueId}/calendar`,   label: "Calendario",  icon: <CalendarDays size={17} /> },
        { href: `/leagues/${leagueId}/playoffs`,   label: "Playoff",     icon: <Swords size={17} /> },
        { href: `/leagues/${leagueId}/teams`,      label: "Squadre",     icon: <Users size={17} /> },
        { href: `/leagues/${leagueId}/players`,    label: "Giocatori",   icon: <Users size={17} /> },
        { href: `/leagues/${leagueId}/stats`,      label: "Statistiche", icon: <BarChart3 size={17} /> },
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
    <aside className="hidden w-[260px] shrink-0 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 lg:block">
      {/* Logo */}
      <div className="mb-5">
        <Link href="/" className="text-lg font-bold italic tracking-tight text-[var(--accent)]">
          FUTBOL
        </Link>
      </div>

      {/* League name */}
      {leagueId && leagueName && (
        <div className="mb-4 rounded-xl border border-[var(--border)] px-3 py-2.5">
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
        className="mb-4 flex items-center gap-2 rounded-xl border border-[var(--border)] bg-white/[0.03] px-3 py-2"
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
            className="rounded-lg bg-[var(--accent)] px-2.5 py-1 text-xs font-semibold text-black"
          >
            Vai
          </button>
        )}
      </form>

      {/* Nav */}
      <nav className="space-y-0.5">
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

      {/* Admin section */}
      {isAdmin && (
        <>
          <div className="my-3 border-t border-[var(--border)]" />
          <p className="mb-1 px-3 text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/30">
            Admin
          </p>
          <NavItem
            href="/admin/users"
            icon={<ShieldCheck size={17} />}
            label="Utenti"
            active={pathname === "/admin/users"}
          />
        </>
      )}

      {/* Bottom */}
      <div className="mt-5 border-t border-[var(--border)] pt-4 space-y-4">
        <AuthButton />
        <div>
          <p className="mb-2 text-[10px] font-medium uppercase tracking-widest text-[var(--foreground)]/30">
            Tema
          </p>
          <ThemePicker />
        </div>
      </div>
    </aside>
  );
}
