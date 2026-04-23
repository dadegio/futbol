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
} from "lucide-react";

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
        "flex items-center gap-3 rounded-2xl px-4 py-3 transition",
        active
          ? "bg-[var(--card-2)] text-[var(--accent)] shadow-[inset_3px_0_0_0_var(--accent)]"
          : "text-[var(--foreground)]/80 hover:bg-black/5 hover:text-[var(--foreground)]",
      ].join(" ")}
    >
      <span className="opacity-90">{icon}</span>
      <span className="text-[16px] md:text-[17px] font-medium">{label}</span>
    </Link>
  );
}

export default function Sidebar({ leagueId }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [leagueName, setLeagueName] = useState<string | null>(null);

  useEffect(() => {
    if (!leagueId) return;
    fetch(`/api/leagues/${leagueId}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        if (d?.name) setLeagueName(d.name);
      })
      .catch(() => {});
  }, [leagueId]);

  const links = leagueId
    ? [
        { href: `/leagues/${leagueId}`, label: "Overview", icon: <Home size={20} /> },
        { href: `/leagues/${leagueId}/table`, label: "Classifica", icon: <Trophy size={20} /> },
        { href: `/leagues/${leagueId}/calendar`, label: "Calendario", icon: <CalendarDays size={20} /> },
        { href: `/leagues/${leagueId}/playoffs`, label: "Playoff", icon: <Swords size={20} /> },
        { href: `/leagues/${leagueId}/teams`, label: "Squadre", icon: <Users size={20} /> },
        { href: `/leagues/${leagueId}/players`, label: "Giocatori", icon: <Users size={20} /> },
        { href: `/leagues/${leagueId}/stats`, label: "Statistiche", icon: <BarChart3 size={20} /> },
      ]
    : [{ href: `/`, label: "Home", icon: <Home size={20} /> }];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueId) return;

    const q = search.trim();

    if (!q) {
      router.push(`/leagues/${leagueId}/players`);
      return;
    }

    router.push(`/leagues/${leagueId}/players?q=${encodeURIComponent(q)}`);
  }

  return (
    <aside className="hidden w-[280px] shrink-0 rounded-[28px] border border-[var(--border)] bg-[var(--card)]/95 p-6 text-[var(--foreground)] shadow-2xl shadow-black/15 lg:block">
      <div className="mb-6">
        <Link
          href="/"
          className="text-[20px] font-extrabold tracking-tight"
        >
          <span className="text-[var(--accent)] italic">FUTBOL</span>
        </Link>
      </div>

      {/* League name header */}
      {leagueId && leagueName && (
        <div className="mb-5 rounded-2xl bg-white/[0.04] px-4 py-3">
          <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/35">
            Torneo
          </div>
          <div className="mt-0.5 truncate text-sm font-bold text-[var(--foreground)]">
            {leagueName}
          </div>
        </div>
      )}

      <form
        onSubmit={submitSearch}
        className="mb-6 flex items-center gap-2 rounded-2xl bg-black/5 px-3 py-3"
      >
        <Search size={18} className="shrink-0 text-[var(--foreground)]/50" />

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={leagueId ? "Cerca giocatore..." : "Search"}
          className="min-w-0 flex-1 bg-transparent text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/40"
        />

        {leagueId ? (
          <button
            type="submit"
            className="rounded-xl bg-[var(--accent)] px-3 py-2 text-sm font-bold text-black"
          >
            Vai
          </button>
        ) : null}
      </form>

      <nav className="space-y-2">
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
    </aside>
  );
}
