"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  LayoutGrid,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  UsersRound,
  X,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { authFetch, useCanAdminLeague } from "@/lib/client-auth";
import { FUTPOLI_RULES } from "@/modules/players/domain/tournament-rules";

type TeamStanding = {
  position: number;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

type TeamRow = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
  players?: Array<{ id: string }>;
  _count?: { players: number };
  standing?: TeamStanding | null;
  nextMatch?: {
    id: string;
    round: number;
    date: string | null;
    phase: "league" | "playoff";
    opponent: { id: string; name: string };
    home: boolean;
  } | null;
  adminRoster?: {
    eligiblePlayers: number;
    attentionPlayers: number;
  };
};

type TeamFilter = "all" | "ready" | "attention" | "full";
type TeamSort = "name" | "standing" | "roster";

function getApiText(data: unknown, key: "error" | "message", fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function playerCount(team: TeamRow) {
  return team.players?.length ?? team._count?.players ?? 0;
}

function formatMatchDate(value: string | null) {
  if (!value) return "Da definire";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Da definire";
  return date.toLocaleString("it-IT", {
    timeZone: "Europe/Rome",
    weekday: "short",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function safeColor(value?: string | null, fallback = "#F97316") {
  return value && /^#[0-9A-Fa-f]{6}$/.test(value) ? value : fallback;
}

export default function TeamsPage({
  leagueId,
  initialTeams,
}: {
  leagueId: string;
  initialTeams: TeamRow[];
}) {
  const isAdmin = useCanAdminLeague(leagueId);

  const [teams, setTeams] = useState<TeamRow[]>(initialTeams);
  const [name, setName] = useState("");
  const [badgeUrl, setBadgeUrl] = useState("");
  const [description, setDescription] = useState("");
  const [colorHex, setColorHex] = useState("#F97316");
  const [secondaryColorHex, setSecondaryColorHex] = useState("#F97316");
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showCreateTeam, setShowCreateTeam] = useState(false);
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TeamFilter>("all");
  const [sort, setSort] = useState<TeamSort>("standing");

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const res = await fetch(`/api/leagues/${leagueId}/teams`, { cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiText(data, "error", "Errore caricamento squadre"));
      setTeams(Array.isArray(data) ? (data as TeamRow[]) : []);
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore caricamento squadre"));
    } finally {
      setLoading(false);
    }
  }

  async function createTeam() {
    setErr(null);
    setMsg(null);
    const teamName = name.trim();
    if (!teamName) {
      setErr("Inserisci il nome squadra");
      return;
    }

    try {
      const res = await authFetch(`/api/leagues/${leagueId}/teams`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: teamName,
          badgeUrl: badgeUrl.trim() ? badgeUrl.trim() : null,
          description: description.trim() || null,
          colorHex,
          secondaryColorHex,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiText(data, "error", "Errore creazione squadra"));

      setName("");
      setBadgeUrl("");
      setDescription("");
      setColorHex("#F97316");
      setSecondaryColorHex("#F97316");
      setMsg("Squadra creata");
      setShowCreateTeam(false);
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore creazione squadra"));
    }
  }

  async function removeTeam(team: TeamRow) {
    setErr(null);
    setMsg(null);
    const confirmed = window.confirm(
      `Rimuovere "${team.name}" dal torneo?\n\n` +
        "Se la squadra è vuota verrà eliminata definitivamente. Se contiene rosa, profilo o storico, i dati resteranno salvati e riutilizzabili."
    );
    if (!confirmed) return;

    try {
      setRemovingTeamId(team.id);
      const res = await authFetch(`/api/teams/${team.id}?leagueId=${encodeURIComponent(leagueId)}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(getApiText(data, "error", "Errore rimozione squadra"));
      setMsg(getApiText(data, "message", "Squadra rimossa dal torneo"));
      await load();
    } catch (error: unknown) {
      setErr(getErrorMessage(error, "Errore rimozione squadra"));
    } finally {
      setRemovingTeamId(null);
    }
  }

  const totals = useMemo(() => {
    const players = teams.reduce((sum, team) => sum + playerCount(team), 0);
    const capacity = teams.length * FUTPOLI_RULES.maxPlayersPerTeam;
    const ready = teams.filter((team) =>
      team.adminRoster
        ? team.adminRoster.eligiblePlayers >= FUTPOLI_RULES.minPlayersInMatchSheet && team.adminRoster.attentionPlayers === 0
        : playerCount(team) >= FUTPOLI_RULES.minPlayersInMatchSheet
    ).length;
    const attention = teams.filter((team) => (team.adminRoster?.attentionPlayers ?? 0) > 0).length;
    return { players, capacity, ready, attention };
  }, [teams]);

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("it");
    return teams
      .filter((team) => !q || team.name.toLocaleLowerCase("it").includes(q))
      .filter((team) => {
        if (filter === "all") return true;
        if (filter === "full") return playerCount(team) >= FUTPOLI_RULES.maxPlayersPerTeam;
        if (filter === "attention") return (team.adminRoster?.attentionPlayers ?? 0) > 0;
        return team.adminRoster
          ? team.adminRoster.eligiblePlayers >= FUTPOLI_RULES.minPlayersInMatchSheet && team.adminRoster.attentionPlayers === 0
          : playerCount(team) >= FUTPOLI_RULES.minPlayersInMatchSheet;
      })
      .sort((a, b) => {
        if (sort === "roster") return playerCount(b) - playerCount(a) || a.name.localeCompare(b.name, "it");
        if (sort === "standing") {
          const pa = a.standing?.position ?? Number.MAX_SAFE_INTEGER;
          const pb = b.standing?.position ?? Number.MAX_SAFE_INTEGER;
          return pa - pb || a.name.localeCompare(b.name, "it");
        }
        return a.name.localeCompare(b.name, "it");
      });
  }, [filter, query, sort, teams]);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Torneo</p>
              <h1 className="mt-1 text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">Squadre</h1>
              <p className="mt-1 text-sm text-[var(--muted)]">Rosa, andamento e prossimi impegni in un’unica vista.</p>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowCreateTeam((value) => !value)}>
                {showCreateTeam ? <X size={17} /> : <Plus size={17} />}
                {showCreateTeam ? "Chiudi" : "Nuova squadra"}
              </Button>
            )}
          </div>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <DirectoryMetric icon={Trophy} label="Squadre" value={String(teams.length)} />
          <DirectoryMetric icon={UsersRound} label="Giocatori" value={String(totals.players)} note={`${totals.capacity} posti rosa`} />
          <DirectoryMetric icon={ShieldCheck} label={isAdmin ? "Rose pronte" : "Rose ≥ 8"} value={`${totals.ready}/${teams.length || 0}`} />
          <DirectoryMetric
            icon={isAdmin && totals.attention > 0 ? CircleAlert : LayoutGrid}
            label={isAdmin ? "Da controllare" : "Posti occupati"}
            value={isAdmin ? String(totals.attention) : `${totals.capacity ? Math.round((totals.players / totals.capacity) * 100) : 0}%`}
            tone={isAdmin && totals.attention > 0 ? "warning" : "default"}
          />
        </div>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {isAdmin && showCreateTeam && (
          <Card className="space-y-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">Configurazione rapida</p>
              <h2 className="mt-1 text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">Nuova squadra</h2>
              <p className="mt-1 text-sm text-[var(--muted)]">Nome e colori bastano per iniziare; stemma e descrizione possono essere aggiunti anche dopo.</p>
            </div>
            <div className="grid gap-3 lg:grid-cols-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nome squadra" />
              <Input value={badgeUrl} onChange={(e) => setBadgeUrl(e.target.value)} placeholder="Logo squadra URL (opzionale)" />
            </div>
            <div className="grid gap-3 sm:grid-cols-[1fr_1fr_2fr]">
              <ColorField label="Colore 1" value={colorHex} onChange={setColorHex} />
              <ColorField label="Colore 2" value={secondaryColorHex} onChange={setSecondaryColorHex} />
              <div className="min-h-11 rounded-2xl border border-[var(--border)]" style={{ background: `linear-gradient(110deg, ${colorHex} 0 50%, ${secondaryColorHex} 50% 100%)` }} />
            </div>
            <textarea
              aria-label="Descrizione squadra"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Identità, motto o breve descrizione"
              rows={3}
              className="min-h-24 w-full resize-none rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
            <div className="flex justify-end"><Button onClick={createTeam}>Crea squadra</Button></div>
          </Card>
        )}

        <Card className="!p-3 sm:!p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px]">
            <label className="relative block">
              <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Cerca squadra…"
                className="h-11 w-full rounded-2xl border border-[var(--border)] bg-[var(--card-2)] pl-11 pr-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
              />
            </label>
            <select value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} className="h-11 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-sm text-[var(--foreground)]">
              <option value="standing">Ordina: classifica</option>
              <option value="name">Ordina: nome</option>
              <option value="roster">Ordina: rosa</option>
            </select>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <FilterChip active={filter === "all"} onClick={() => setFilter("all")}>Tutte</FilterChip>
            <FilterChip active={filter === "ready"} onClick={() => setFilter("ready")}>{isAdmin ? "Rose pronte" : "Almeno 8"}</FilterChip>
            {isAdmin && <FilterChip active={filter === "attention"} onClick={() => setFilter("attention")}>Da completare</FilterChip>}
            <FilterChip active={filter === "full"} onClick={() => setFilter("full")}>Rosa piena</FilterChip>
          </div>
        </Card>

        {loading && <p className="text-sm text-[var(--muted)]">Aggiornamento squadre…</p>}

        {!loading && teams.length === 0 && (
          <Card className="py-10 text-center">
            <Trophy size={28} className="mx-auto text-[var(--accent)]" />
            <p className="mt-3 font-black text-[var(--foreground)]">Nessuna squadra presente</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Crea la prima squadra per iniziare il torneo.</p>
          </Card>
        )}

        {!loading && teams.length > 0 && visibleTeams.length === 0 && (
          <Card className="py-8 text-center"><p className="text-sm text-[var(--muted)]">Nessuna squadra corrisponde ai filtri.</p></Card>
        )}

        {!loading && visibleTeams.length > 0 && (
          <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {visibleTeams.map((team) => (
              <TeamCard
                key={team.id}
                leagueId={leagueId}
                team={team}
                isAdmin={isAdmin}
                removing={removingTeamId === team.id}
                onRemove={() => removeTeam(team)}
              />
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function TeamCard({ leagueId, team, isAdmin, removing, onRemove }: { leagueId: string; team: TeamRow; isAdmin: boolean; removing: boolean; onRemove: () => void }) {
  const count = playerCount(team);
  const primary = safeColor(team.colorHex);
  const secondary = safeColor(team.secondaryColorHex, primary);
  const percentage = Math.min(100, Math.round((count / FUTPOLI_RULES.maxPlayersPerTeam) * 100));
  const attention = team.adminRoster?.attentionPlayers ?? 0;

  return (
    <Card className="group relative overflow-hidden !p-0">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
      <div className="p-4 sm:p-5">
        <div className="flex items-start gap-4">
          <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="truncate text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">{team.name}</h2>
                  {team.standing && team.standing.played > 0 && <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[10px] font-black text-[var(--accent)]">#{team.standing.position}</span>}
                </div>
                {team.description && <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{team.description}</p>}
              </div>
              {isAdmin && (
                <button type="button" onClick={onRemove} disabled={removing} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50" aria-label={`Rimuovi ${team.name}`}>
                  {removing ? <span className="text-xs font-black">…</span> : <Trash2 size={15} />}
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-3 gap-2">
          <MiniMetric label="Rosa" value={`${count}/${FUTPOLI_RULES.maxPlayersPerTeam}`} />
          <MiniMetric label="Punti" value={String(team.standing?.points ?? 0)} />
          <MiniMetric label="Record" value={team.standing ? `${team.standing.wins}-${team.standing.draws}-${team.standing.losses}` : "0-0-0"} />
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-[10px] font-bold text-[var(--muted)]">
            <span>Completamento rosa</span><span>{percentage}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${percentage}%`, background: `linear-gradient(90deg, ${primary}, ${secondary})` }} /></div>
        </div>

        {isAdmin && team.adminRoster && (
          <div className={[
            "mt-4 flex items-center gap-2 rounded-2xl border px-3 py-2 text-xs font-bold",
            attention > 0 ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300" : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
          ].join(" ")}>
            {attention > 0 ? <CircleAlert size={14} /> : <ShieldCheck size={14} />}
            {attention > 0 ? `${attention} giocator${attention === 1 ? "e" : "i"} da completare` : `${team.adminRoster.eligiblePlayers} giocatori idonei`}
          </div>
        )}

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          {team.nextMatch ? (
            <div className="flex items-center gap-3">
              <CalendarClock size={16} className="shrink-0 text-[var(--accent)]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-black text-[var(--foreground)]">{team.nextMatch.home ? "vs" : "@"} {team.nextMatch.opponent.name}</p>
                <p className="mt-0.5 text-[10px] text-[var(--muted)]">{team.nextMatch.phase === "playoff" ? "Playoff" : `Giornata ${team.nextMatch.round}`} · {formatMatchDate(team.nextMatch.date)}</p>
              </div>
            </div>
          ) : (
            <p className="text-xs text-[var(--muted)]">Nessuna prossima partita programmata.</p>
          )}
        </div>

        <Link href={`/leagues/${leagueId}/teams/${team.id}`} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-2xl border border-[var(--border-strong)] bg-[var(--card-2)] text-sm font-black text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]">
          Apri squadra <ChevronRight size={15} />
        </Link>
      </div>
    </Card>
  );
}

function DirectoryMetric({ icon: Icon, label, value, note, tone = "default" }: { icon: typeof Trophy; label: string; value: string; note?: string; tone?: "default" | "warning" }) {
  return (
    <Card className="!p-4">
      <div className={[
        "grid h-9 w-9 place-items-center rounded-xl",
        tone === "warning" ? "bg-amber-500/10 text-amber-300" : "bg-[var(--accent-soft)] text-[var(--accent)]",
      ].join(" ")}><Icon size={16} /></div>
      <p className="mt-3 text-2xl font-black tracking-[-0.05em] text-[var(--foreground)]">{value}</p>
      <p className="text-[11px] font-bold text-[var(--muted)]">{label}</p>
      {note && <p className="mt-1 text-[10px] text-[var(--muted)]">{note}</p>}
    </Card>
  );
}

function MiniMetric({ label, value }: { label: string; value: string }) {
  return <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-2 text-center"><p className="text-sm font-black text-[var(--foreground)]">{value}</p><p className="mt-0.5 text-[9px] font-bold uppercase tracking-wider text-[var(--muted)]">{label}</p></div>;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return <button type="button" onClick={onClick} className={[
    "shrink-0 rounded-full border px-3 py-1.5 text-xs font-black transition",
    active ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent)]" : "border-[var(--border)] bg-[var(--card-2)] text-[var(--muted)]",
  ].join(" ")}>{children}</button>;
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-2.5 text-xs font-bold text-[var(--muted)]"><input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" /><span>{label}</span></label>;
}

function TeamLogo({ name, badgeUrl }: { name: string; badgeUrl: string | null }) {
  const initials = name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();
  if (badgeUrl) return <img src={badgeUrl} alt={`Logo ${name}`} className="h-16 w-16 shrink-0 rounded-[20px] object-contain sm:h-[72px] sm:w-[72px]" />;
  return <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[20px] bg-[var(--accent-soft)] text-base font-black text-[var(--accent)] sm:h-[72px] sm:w-[72px]">{initials}</span>;
}
