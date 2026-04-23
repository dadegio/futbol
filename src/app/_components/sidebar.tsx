"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  Home,
  Trophy,
  CalendarDays,
  Users,
  BarChart3,
  Search,
  X,
  Swords,
} from "lucide-react";

type SidebarProps = {
  leagueId?: string;
  mobile?: boolean;
  onNavigate?: () => void;
};

function NavItem({
  href,
  icon,
  label,
  active = false,
  onNavigate,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onNavigate}
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

export default function Sidebar({ leagueId, mobile = false, onNavigate }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [search, setSearch] = useState("");

  const links = leagueId
    ? [
        { href: `/leagues/${leagueId}`, label: "Overview", icon: <Home size={20} /> },
        { href: `/leagues/${leagueId}/table`, label: "Leader Board", icon: <Trophy size={20} /> },
        { href: `/leagues/${leagueId}/calendar`, label: "Calendar", icon: <CalendarDays size={20} /> },
        { href: `/leagues/${leagueId}/playoffs`, label: "Playoff", icon: <Swords size={20} /> },
        { href: `/leagues/${leagueId}/teams`, label: "Teams", icon: <Users size={20} /> },
        { href: `/leagues/${leagueId}/players`, label: "Players", icon: <Users size={20} /> },
        { href: `/leagues/${leagueId}/stats`, label: "Stats", icon: <BarChart3 size={20} /> },
      ]
    : [{ href: `/`, label: "Home", icon: <Home size={20} /> }];

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    if (!leagueId) return;

    const q = search.trim();

    if (!q) {
      router.push(`/leagues/${leagueId}/players`);
      onNavigate?.();
      return;
    }

    router.push(`/leagues/${leagueId}/players?q=${encodeURIComponent(q)}`);
    onNavigate?.();
  }

  return (
    <aside
      className={[
        "shrink-0 rounded-[28px] border border-[var(--border)] bg-[var(--card)]/95 text-[var(--foreground)] shadow-2xl shadow-black/15",
        mobile ? "w-full p-5" : "hidden w-[280px] p-6 lg:block",
      ].join(" ")}
    >
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/"
          onClick={onNavigate}
          className="text-[20px] font-extrabold tracking-tight"
        >
          <span className="text-[var(--accent)] italic">FUTBOL</span>
        </Link>

        {mobile ? (
          <button
            onClick={onNavigate}
            className="rounded-xl border border-[var(--border)] bg-white/5 p-2 text-[var(--foreground)]/80"
            aria-label="Chiudi menu"
          >
            <X size={18} />
          </button>
        ) : null}
      </div>

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
            onNavigate={onNavigate}
          />
        ))}
      </nav>
    </aside>
  );
}