"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  CalendarClock,
  ChevronRight,
  CircleAlert,
  Plus,
  Search,
  ShieldCheck,
  Trash2,
  Trophy,
  X,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Badge from "src/app/_components/ui/badge";
import { authFetch, useCanAdminLeague } from "@/lib/client-auth";


type TeamStanding = {
  position: number;
  played: number;
  points: number;
};

type TeamRow = {
  id: string;
  name: string;
  badgeUrl?: string | null;
  description?: string | null;
  colorHex?: string | null;
  secondaryColorHex?: string | null;
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

type TeamSort = "name" | "standing";

function getApiText(data: unknown, key: "error" | "message", fallback: string) {
  if (typeof data !== "object" || data === null) return fallback;
  const value = (data as Record<string, unknown>)[key];
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

function formatMatchDate(value: string | null) {
  if (!value) return "Data da definire";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data da definire";
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
  const [sort, setSort] = useState<TeamSort>("name");

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
    if (!teamName) return setErr("Inserisci il nome squadra");

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

  const visibleTeams = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("it");
    return teams
      .filter((team) => !q || team.name.toLocaleLowerCase("it").includes(q))
      .sort((a, b) => {
        if (sort === "standing") {
          const pa = a.standing?.position ?? Number.MAX_SAFE_INTEGER;
          const pb = b.standing?.position ?? Number.MAX_SAFE_INTEGER;
          return pa - pb || a.name.localeCompare(b.name, "it");
        }
        return a.name.localeCompare(b.name, "it");
      });
  }, [query, sort, teams]);

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="border-b border-[var(--border-strong)] pb-6 pt-2">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-[var(--accent)]">Club del torneo</p>
              <h1 className="scoreboard-figure mt-1 text-[46px] font-semibold leading-none text-[var(--foreground)] sm:text-[64px]">SQUADRE</h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                {teams.length} {teams.length === 1 ? "squadra" : "squadre"} in gara. Apri un club per vedere rosa, profili e prossimi impegni.
              </p>
            </div>
            {isAdmin && (
              <Button onClick={() => setShowCreateTeam((value) => !value)}>
                {showCreateTeam ? <X size={17} /> : <Plus size={17} />}
                {showCreateTeam ? "Chiudi" : "Nuova squadra"}
              </Button>
            )}
          </div>
        </header>

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

        <div className="grid gap-3 border-y border-[var(--border)] py-4 sm:grid-cols-[minmax(0,1fr)_190px]">
          <label className="relative block">
            <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--muted)]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Cerca una squadra…"
              className="h-11 w-full rounded-[5px] border border-[var(--border)] bg-transparent pl-11 pr-4 text-sm text-[var(--foreground)] outline-none focus:border-[var(--accent)]"
            />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as TeamSort)} className="h-11 rounded-[5px] border border-[var(--border)] bg-transparent px-3 text-sm text-[var(--foreground)]">
            <option value="name">Ordina: nome</option>
            <option value="standing">Ordina: classifica</option>
          </select>
        </div>

        {loading && <p className="text-sm text-[var(--muted)]">Aggiornamento squadre…</p>}

        {!loading && teams.length === 0 && (
          <Card className="py-10 text-center">
            <Trophy size={28} className="mx-auto text-[var(--accent)]" />
            <p className="mt-3 font-black text-[var(--foreground)]">Nessuna squadra presente</p>
            <p className="mt-1 text-sm text-[var(--muted)]">Il torneo non ha ancora squadre pubblicate.</p>
          </Card>
        )}

        {!loading && teams.length > 0 && visibleTeams.length === 0 && (
          <Card className="py-8 text-center"><p className="text-sm text-[var(--muted)]">Nessuna squadra corrisponde alla ricerca.</p></Card>
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
  const primary = safeColor(team.colorHex);
  const secondary = safeColor(team.secondaryColorHex, primary);
  const attention = team.adminRoster?.attentionPlayers ?? 0;

  return (
    <article className="group relative overflow-hidden rounded-[8px] border border-[var(--border)] bg-[var(--card)] transition-colors hover:border-[var(--border-strong)]">
      <div className="h-1.5" style={{ background: `linear-gradient(90deg, ${primary}, ${secondary})` }} />
      <div className="relative p-5 sm:p-6">
        <div className="hidden" style={{ background: `${primary}22` }} />
        <div className="relative flex items-start gap-4">
          <TeamLogo name={team.name} badgeUrl={team.badgeUrl ?? null} />
          <div className="min-w-0 flex-1 pt-1">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[var(--muted)]">Club</p>
                <h2 className="mt-1 break-words text-xl font-black tracking-[-0.05em] text-[var(--foreground)]">{team.name}</h2>
                {team.description && <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-[var(--muted)]">{team.description}</p>}
              </div>
              {isAdmin && (
                <button type="button" onClick={onRemove} disabled={removing} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-500/10 text-red-300 hover:bg-red-500/20 disabled:opacity-50" aria-label={`Rimuovi ${team.name}`}>
                  {removing ? <span className="text-xs font-black">…</span> : <Trash2 size={15} />}
                </button>
              )}
            </div>
          </div>
        </div>

        {isAdmin && team.adminRoster && (
          <div className={[
            "relative mt-4 flex items-center gap-2 rounded-[4px] border px-3 py-2 text-xs font-bold",
            attention > 0 ? "border-amber-400/20 bg-amber-400/[0.06] text-amber-300" : "border-emerald-400/20 bg-emerald-400/[0.06] text-emerald-300",
          ].join(" ")}>
            {attention > 0 ? <CircleAlert size={14} /> : <ShieldCheck size={14} />}
            {attention > 0 ? `${attention} giocator${attention === 1 ? "e" : "i"} da completare` : "Rosa amministrativa in ordine"}
          </div>
        )}

        <div className="relative mt-5 overflow-hidden rounded-[6px] border border-white/10 bg-black/30">
          <div
            className="absolute inset-0 opacity-90"
            style={{ background: `linear-gradient(118deg, ${primary}3D 0%, ${primary}16 42%, ${secondary}32 100%)` }}
          />
          {team.badgeUrl && (
            <img
              src={team.badgeUrl}
              alt=""
              aria-hidden="true"
              className="pointer-events-none absolute -right-8 -top-9 h-40 w-40 rotate-[-9deg] object-contain opacity-[0.12] blur-[1px] transition duration-500 group-hover:scale-[1.04] group-hover:opacity-[0.17]"
            />
          )}
          <div className="pointer-events-none absolute inset-y-0 left-0 w-1" style={{ background: `linear-gradient(${primary}, ${secondary})` }} />

          <div className="relative min-h-[132px] p-4">
            <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-white/55">
              <CalendarClock size={13} /> Prossima partita
            </div>
            {team.nextMatch ? (
              <>
                <p className="mt-5 max-w-[78%] text-lg font-black leading-tight tracking-[-0.035em] text-white">
                  {team.nextMatch.home ? "vs" : "@"} {team.nextMatch.opponent.name}
                </p>
                <p className="mt-2 text-xs font-bold text-white/65">
                  {team.nextMatch.phase === "playoff" ? "Playoff" : `Giornata ${team.nextMatch.round}`} · {formatMatchDate(team.nextMatch.date)}
                </p>
              </>
            ) : (
              <p className="mt-5 max-w-[80%] text-sm font-bold leading-relaxed text-white/60">Nessun prossimo incontro programmato.</p>
            )}
          </div>
        </div>

        <Link href={`/leagues/${leagueId}/teams/${team.id}`} className="relative mt-4 flex min-h-10 w-full items-center justify-between border-t border-[var(--border)] px-0 pt-3 text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--accent)] transition hover:text-[var(--foreground)]">
          <span>Apri squadra</span><ChevronRight size={16} />
        </Link>
      </div>
    </article>
  );
}

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return <label className="flex h-11 items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-2.5 text-xs font-bold text-[var(--muted)]"><input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} className="h-8 w-10 cursor-pointer rounded-lg border-0 bg-transparent p-0" /><span>{label}</span></label>;
}

function TeamLogo({ name, badgeUrl }: { name: string; badgeUrl: string | null }) {
  const initials = name.split(" ").map((word) => word[0]).join("").slice(0, 2).toUpperCase();

  if (badgeUrl) {
    return (
      <div className="relative h-[82px] w-[82px] shrink-0 overflow-hidden rounded-[10px] border border-white/10 bg-black/20 ">
        <img
          src={badgeUrl}
          alt={`Logo ${name}`}
          className="absolute inset-0 h-full w-full object-contain"
        />
      </div>
    );
  }

  return <span className="flex h-[82px] w-[82px] shrink-0 items-center justify-center rounded-[10px] border border-[var(--border)] bg-[var(--accent-soft)] text-lg font-black text-[var(--accent)]">{initials}</span>;
}
