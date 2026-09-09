"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { CalendarDays, Search, ShieldCheck, UserRound, UsersRound, X, type LucideIcon } from "lucide-react";
import { authFetch } from "@/lib/client-auth";

type SearchResult = {
  query: string;
  teams: Array<{ id: string; name: string; badgeUrl: string | null }>;
  players: Array<{ id: string; firstName: string; lastName: string; number: number; eligible: boolean; team: { id: string; name: string } }>;
  referees: Array<{ id: string; name: string; active: boolean; team: { name: string } | null }>;
  matches: Array<{ id: string; round: number; date: string | null; homeGoals: number | null; awayGoals: number | null; homeTeam: { name: string }; awayTeam: { name: string } }>;
};

const EMPTY: SearchResult = { query: "", teams: [], players: [], referees: [], matches: [] };

export default function AdminQuickSearch({ leagueId }: { leagueId: string }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const requestId = useRef(0);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }

    const current = ++requestId.current;
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const response = await authFetch(`/api/leagues/${leagueId}/admin/search?q=${encodeURIComponent(q)}`, { cache: "no-store" });
        const payload = (await response.json().catch(() => EMPTY)) as SearchResult;
        if (response.ok && current === requestId.current) {
          setResults(payload);
          setOpen(true);
        }
      } finally {
        if (current === requestId.current) setLoading(false);
      }
    }, 180);

    return () => window.clearTimeout(timer);
  }, [leagueId, query]);

  const count = results.teams.length + results.players.length + results.referees.length + results.matches.length;

  function clear() {
    setQuery("");
    setResults(EMPTY);
    setOpen(false);
  }

  return (
    <div className="relative w-full sm:max-w-[420px]">
      <div className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 focus-within:border-[var(--accent)]">
        <Search size={16} className="shrink-0 text-[var(--accent)]" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onFocus={() => query.trim().length >= 2 && setOpen(true)}
          placeholder="Cerca squadra, giocatore, arbitro…"
          className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-[var(--foreground)] outline-none placeholder:text-[var(--muted)]"
        />
        {loading && <span className="text-[10px] font-bold text-[var(--muted)]">…</span>}
        {query && <button type="button" onClick={clear} className="text-[var(--muted)] hover:text-[var(--foreground)]"><X size={15} /></button>}
      </div>

      {open && query.trim().length >= 2 && (
        <div className="absolute right-0 top-[calc(100%+8px)] z-50 max-h-[68vh] w-full min-w-[320px] overflow-auto rounded-2xl border border-[var(--border)] bg-[var(--card)] p-2 shadow-[0_24px_80px_rgba(0,0,0,.45)]">
          {count === 0 && !loading ? (
            <p className="px-3 py-4 text-sm text-[var(--muted)]">Nessun risultato per “{query.trim()}”.</p>
          ) : (
            <div className="space-y-3">
              {results.teams.length > 0 && <ResultGroup label="Squadre" icon={UsersRound}>{results.teams.map((team) => <ResultLink key={team.id} href={`/leagues/${leagueId}/teams/${team.id}`} primary={team.name} secondary="Squadra" onClick={() => setOpen(false)} />)}</ResultGroup>}
              {results.players.length > 0 && <ResultGroup label="Giocatori" icon={UserRound}>{results.players.map((player) => <ResultLink key={player.id} href={`/leagues/${leagueId}/players/${player.id}`} primary={`${player.firstName} ${player.lastName} · #${player.number}`} secondary={`${player.team.name} · ${player.eligible ? "iscrizione OK" : "da verificare"}`} onClick={() => setOpen(false)} />)}</ResultGroup>}
              {results.referees.length > 0 && <ResultGroup label="Arbitri" icon={ShieldCheck}>{results.referees.map((referee) => <ResultLink key={referee.id} href={`/leagues/${leagueId}/admin#referees`} primary={referee.name} secondary={`${referee.active ? "Attivo" : "Disattivato"}${referee.team ? ` · gioca in ${referee.team.name}` : ""}`} onClick={() => setOpen(false)} />)}</ResultGroup>}
              {results.matches.length > 0 && <ResultGroup label="Partite" icon={CalendarDays}>{results.matches.map((match) => <ResultLink key={match.id} href={`/leagues/${leagueId}/matches/${match.id}`} primary={`${match.homeTeam.name} vs ${match.awayTeam.name}`} secondary={`Giornata ${match.round}${match.date ? ` · ${new Date(match.date).toLocaleDateString("it-IT")}` : " · da programmare"}`} onClick={() => setOpen(false)} />)}</ResultGroup>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function ResultGroup({ label, icon: Icon, children }: { label: string; icon: LucideIcon; children: ReactNode }) {
  return <div><p className="flex items-center gap-1.5 px-2 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[var(--accent)]"><Icon size={12} /> {label}</p><div className="space-y-1">{children}</div></div>;
}

function ResultLink({ href, primary, secondary, onClick }: { href: string; primary: string; secondary: string; onClick: () => void }) {
  return <Link href={href} onClick={onClick} className="block rounded-xl px-3 py-2.5 transition hover:bg-[var(--card-2)]"><span className="block truncate text-sm font-black text-[var(--foreground)]">{primary}</span><span className="mt-0.5 block truncate text-[11px] text-[var(--muted)]">{secondary}</span></Link>;
}
