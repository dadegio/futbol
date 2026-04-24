"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Button from "src/app/_components/ui/button";
import Badge from "src/app/_components/ui/badge";
import { useAuth, authFetch } from "@/lib/client-auth";

type Player = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  teamId: string;
};

type Team = {
  id: string;
  name: string;
  players: Player[];
};

type StatRow = {
  id: string;
  matchId: string;
  playerId: string;
  goals: number;
  assists: number;
};

type Match = {
  id: string;
  round: number;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
  stats: StatRow[];
  leagueId: string;
};

export default function MatchResultForm({ match }: { match: Match }) {
  const { user, loading: authLoading } = useAuth();
  const canEdit =
    !authLoading &&
    (user?.role === "ADMIN" ||
      (user?.role === "CAPTAIN" &&
        (user.teamId === match.homeTeam?.id || user.teamId === match.awayTeam?.id)));

  const router = useRouter();

  const [homeGoals, setHomeGoals] = useState<string>(
    match.homeGoals === null ? "" : String(match.homeGoals)
  );
  const [awayGoals, setAwayGoals] = useState<string>(
    match.awayGoals === null ? "" : String(match.awayGoals)
  );
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const initial = useMemo(() => {
    const m = new Map<string, { goals: number; assists: number }>();
    for (const s of match.stats) m.set(s.playerId, { goals: s.goals, assists: s.assists });
    return m;
  }, [match.stats]);

  const [stats, setStats] = useState<Record<string, { goals: string; assists: string }>>(() => {
    const out: Record<string, { goals: string; assists: string }> = {};
    for (const p of [...match.homeTeam.players, ...match.awayTeam.players]) {
      const s = initial.get(p.id);
      out[p.id] = { goals: s ? String(s.goals) : "", assists: s ? String(s.assists) : "" };
    }
    return out;
  });

  const homePlayers = useMemo(
    () => match.homeTeam.players.slice().sort((a, b) => a.number - b.number),
    [match.homeTeam.players]
  );
  const awayPlayers = useMemo(
    () => match.awayTeam.players.slice().sort((a, b) => a.number - b.number),
    [match.awayTeam.players]
  );

  const totals = useMemo(() => {
    let goalsSum = 0, assistsSum = 0;
    for (const p of [...homePlayers, ...awayPlayers]) {
      goalsSum += Number(stats[p.id]?.goals || 0);
      assistsSum += Number(stats[p.id]?.assists || 0);
    }
    return { goalsSum, assistsSum };
  }, [stats, homePlayers, awayPlayers]);

  function setPlayerStat(playerId: string, key: "goals" | "assists", value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    setStats((prev) => ({
      ...prev,
      [playerId]: { ...prev[playerId], [key]: cleaned === "" ? "0" : cleaned },
    }));
  }

  async function save() {
    setErr(null);
    setMsg(null);
    const hg = homeGoals.trim() === "" ? null : Number(homeGoals);
    const ag = awayGoals.trim() === "" ? null : Number(awayGoals);
    if (hg !== null && (!Number.isFinite(hg) || hg < 0)) { setErr("Gol squadra casa non valido"); return; }
    if (ag !== null && (!Number.isFinite(ag) || ag < 0)) { setErr("Gol squadra ospite non valido"); return; }
    const playerStats = [...homePlayers, ...awayPlayers]
      .map((p) => ({ playerId: p.id, goals: Number(stats[p.id]?.goals || 0), assists: Number(stats[p.id]?.assists || 0) }))
      .filter((s) => s.goals > 0 || s.assists > 0);
    setSaving(true);
    try {
      const res = await authFetch(`/api/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ homeGoals: hg === null ? undefined : hg, awayGoals: ag === null ? undefined : ag, playerStats }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore salvataggio");
      setMsg("Salvato");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell leagueId={match.leagueId}>
      <div className="space-y-5">

        {/* Header */}
        <Card>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-widest text-[var(--accent)]/70">
                Giornata {match.round}
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {match.homeTeam.name}
                <span className="mx-3 font-normal text-[var(--foreground)]/30">vs</span>
                {match.awayTeam.name}
              </h1>
            </div>
            <Link
              href={`/leagues/${match.leagueId}/calendar`}
              className="flex w-fit items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-xs text-[var(--foreground)]/60 hover:text-[var(--foreground)]"
            >
              <ArrowLeft size={13} /> Calendario
            </Link>
          </div>
        </Card>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {!canEdit && !authLoading && (
          <Card variant="flat">
            <p className="text-sm text-[var(--foreground)]/50">
              Sola lettura — accedi come admin o capitano per modificare.
            </p>
          </Card>
        )}

        {/* Score */}
        <Card>
          <h2 className="mb-4 text-sm font-medium text-[var(--foreground)]/50">Risultato</h2>
          <div className="grid grid-cols-2 gap-4">
            <ScoreBox
              label={match.homeTeam.name}
              value={homeGoals}
              onChange={(v) => canEdit && setHomeGoals(v.replace(/[^\d]/g, ""))}
              readOnly={!canEdit}
            />
            <ScoreBox
              label={match.awayTeam.name}
              value={awayGoals}
              onChange={(v) => canEdit && setAwayGoals(v.replace(/[^\d]/g, ""))}
              readOnly={!canEdit}
            />
          </div>
        </Card>

        {/* Player stats */}
        <div className="grid gap-5 xl:grid-cols-2">
          <TeamStatsCard
            title={match.homeTeam.name}
            players={homePlayers}
            stats={stats}
            setPlayerStat={setPlayerStat}
            readOnly={!canEdit}
          />
          <TeamStatsCard
            title={match.awayTeam.name}
            players={awayPlayers}
            stats={stats}
            setPlayerStat={setPlayerStat}
            readOnly={!canEdit}
          />
        </div>

        {/* Save — placed AFTER stats so user doesn't need to scroll back up */}
        {canEdit && (
          <Card>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex gap-4 text-sm text-[var(--foreground)]/50">
                <span>Gol: <b className="text-[var(--foreground)]">{totals.goalsSum}</b></span>
                <span>Assist: <b className="text-[var(--foreground)]">{totals.assistsSum}</b></span>
              </div>
              <Button onClick={save} disabled={saving}>
                {saving ? "Salvataggio…" : "Salva risultato e statistiche"}
              </Button>
            </div>
          </Card>
        )}

      </div>
    </DashboardShell>
  );
}

function ScoreBox({
  label, value, onChange, readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--card-2)] p-4">
      <p className="mb-3 truncate text-xs font-medium uppercase tracking-widest text-[var(--foreground)]/40">
        {label}
      </p>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="numeric"
        readOnly={readOnly}
        className={[
          "h-14 w-full rounded-xl border border-[var(--border)] bg-white/5 text-center text-3xl font-bold text-[var(--foreground)] outline-none placeholder:text-[var(--foreground)]/20",
          readOnly ? "cursor-default opacity-60" : "transition-colors focus:border-[var(--accent)]/50",
        ].join(" ")}
      />
    </div>
  );
}

function TeamStatsCard({
  title, players, stats, setPlayerStat, readOnly,
}: {
  title: string;
  players: Player[];
  stats: Record<string, { goals: string; assists: string }>;
  setPlayerStat: (playerId: string, key: "goals" | "assists", value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <Card>
      <h2 className="mb-4 font-semibold text-[var(--foreground)]">{title}</h2>

      {players.length === 0 ? (
        <p className="text-sm text-[var(--foreground)]/40">Nessun giocatore disponibile.</p>
      ) : (
        <div className="space-y-2">
          {players.map((p) => (
            <div
              key={p.id}
              className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 py-2.5"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[var(--foreground)]">
                  <span className="mr-1.5 text-[var(--foreground)]/35">#{p.number}</span>
                  {p.firstName} {p.lastName}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2.5">
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/50">Gol</span>
                  <input
                    aria-label={`Gol di ${p.firstName} ${p.lastName}`}
                    value={stats[p.id]?.goals ?? ""}
                    placeholder="0"
                    onChange={(e) => !readOnly && setPlayerStat(p.id, "goals", e.target.value)}
                    inputMode="numeric"
                    readOnly={readOnly}
                    className={[
                      "h-9 w-14 rounded-lg border border-[var(--border)] bg-white/5 text-center text-sm font-bold text-[var(--foreground)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
                      readOnly ? "cursor-default opacity-60" : "focus:border-[var(--accent)]/50",
                    ].join(" ")}
                  />
                </div>
                <div className="flex flex-col items-center gap-0.5">
                  <span className="text-[10px] uppercase tracking-widest text-[var(--foreground)]/50">Assist</span>
                  <input
                    aria-label={`Assist di ${p.firstName} ${p.lastName}`}
                    value={stats[p.id]?.assists ?? ""}
                    placeholder="0"
                    onChange={(e) => !readOnly && setPlayerStat(p.id, "assists", e.target.value)}
                    inputMode="numeric"
                    readOnly={readOnly}
                    className={[
                      "h-9 w-14 rounded-lg border border-[var(--border)] bg-white/5 text-center text-sm font-bold text-[var(--foreground)] outline-none focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--accent)]",
                      readOnly ? "cursor-default opacity-60" : "focus:border-[var(--accent)]/50",
                    ].join(" ")}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
