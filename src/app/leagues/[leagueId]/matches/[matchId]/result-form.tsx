"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import DashboardShell from "src/app/_components/dashboard-shell";
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
        (user.teamId === match.homeTeamId || user.teamId === match.awayTeamId)));
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
    for (const s of match.stats) {
      m.set(s.playerId, { goals: s.goals, assists: s.assists });
    }
    return m;
  }, [match.stats]);

  const [stats, setStats] = useState<Record<string, { goals: string; assists: string }>>(() => {
    const out: Record<string, { goals: string; assists: string }> = {};
    const allPlayers = [...match.homeTeam.players, ...match.awayTeam.players];

    for (const p of allPlayers) {
      const s = initial.get(p.id);
      out[p.id] = {
        goals: s ? String(s.goals) : "",
        assists: s ? String(s.assists) : "",
      };
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
    const allPlayers = [...homePlayers, ...awayPlayers];
    let goalsSum = 0;
    let assistsSum = 0;

    for (const p of allPlayers) {
      const g = Number(stats[p.id]?.goals || 0);
      const a = Number(stats[p.id]?.assists || 0);
      goalsSum += g;
      assistsSum += a;
    }

    return { goalsSum, assistsSum };
  }, [stats, homePlayers, awayPlayers]);

  function setPlayerStat(playerId: string, key: "goals" | "assists", value: string) {
    const cleaned = value.replace(/[^\d]/g, "");
    setStats((prev) => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        [key]: cleaned === "" ? "0" : cleaned,
      },
    }));
  }

  async function save() {
    setErr(null);
    setMsg(null);

    const hg = homeGoals.trim() === "" ? null : Number(homeGoals);
    const ag = awayGoals.trim() === "" ? null : Number(awayGoals);

    if (hg !== null && (!Number.isFinite(hg) || hg < 0)) {
      setErr("Gol squadra casa non valido");
      return;
    }

    if (ag !== null && (!Number.isFinite(ag) || ag < 0)) {
      setErr("Gol squadra ospite non valido");
      return;
    }

    const allPlayers = [...homePlayers, ...awayPlayers];
    const playerStats = allPlayers
      .map((p) => {
        const g = Number(stats[p.id]?.goals || 0);
        const a = Number(stats[p.id]?.assists || 0);
        return { playerId: p.id, goals: g, assists: a };
      })
      .filter((s) => s.goals > 0 || s.assists > 0);

    setSaving(true);

    try {
      const res = await authFetch(`/api/matches/${match.id}/result`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          homeGoals: hg === null ? undefined : hg,
          awayGoals: ag === null ? undefined : ag,
          playerStats,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as any)?.error ?? "Errore salvataggio");
      }

      setMsg("Salvato ✅");
      router.refresh();
    } catch (e: any) {
      setErr(e.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <DashboardShell leagueId={match.leagueId}>
      <div className="space-y-6">
        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-sm font-medium uppercase tracking-[0.2em] text-[var(--accent)]">
                Match Detail
              </div>
              <h1 className="mt-2 text-3xl font-black text-white">
                {match.homeTeam.name} <span className="text-white/35">vs</span> {match.awayTeam.name}
              </h1>
              <p className="mt-2 text-sm text-white/60">Giornata {match.round}</p>
            </div>

            <Link
              href={`/leagues/${match.leagueId}/calendar`}
              className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white/80 hover:bg-white/10"
            >
              ← Torna al calendario
            </Link>
          </div>
        </section>

        {msg ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-200">
            {msg}
          </div>
        ) : null}

        {err ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {err}
          </div>
        ) : null}

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-6 shadow-2xl shadow-black/20">
          {!canEdit && (
            <div className="mb-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[var(--foreground)]/60">
              Sola lettura — accedi come admin o capitano per modificare il risultato.
            </div>
          )}

          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div className="grid gap-4 md:grid-cols-2">
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

            <div className="flex flex-col gap-3 xl:items-end">
              {canEdit && (
                <button
                  onClick={save}
                  disabled={saving}
                  className="rounded-2xl bg-[var(--accent)] px-5 py-3 font-bold text-black disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? "Salvataggio..." : "Salva risultato + stats"}
                </button>
              )}

              <div className="flex flex-wrap gap-3 text-sm text-white/65">
                <div className="rounded-2xl bg-white/5 px-4 py-2">
                  Gol inseriti: <b className="text-white">{totals.goalsSum}</b>
                </div>
                <div className="rounded-2xl bg-white/5 px-4 py-2">
                  Assist inseriti: <b className="text-white">{totals.assistsSum}</b>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
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
        </section>

        <section className="rounded-[28px] border border-white/8 bg-[#121214]/95 p-5 shadow-2xl shadow-black/20">
          <div className="mb-3 text-xl font-black text-white">Note rapide</div>
          <ul className="list-disc space-y-2 pl-5 text-sm leading-6 text-white/60">
            <li>Inserisci gol e assist solo per i giocatori che ne hanno fatti.</li>
            <li>Il salvataggio sovrascrive completamente le statistiche della partita.</li>
            <li>Puoi rientrare nella partita in qualsiasi momento e correggere i dati.</li>
          </ul>
        </section>
      </div>
    </DashboardShell>
  );
}

function ScoreBox({
  label,
  value,
  onChange,
  readOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="rounded-[24px] border border-white/8 bg-[#17171a] p-5">
      <div className="text-sm uppercase tracking-[0.18em] text-white/40">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        inputMode="numeric"
        readOnly={readOnly}
        className={[
          "mt-4 h-16 w-full rounded-2xl border border-white/10 bg-white/5 px-4 text-center text-3xl font-black text-white outline-none placeholder:text-white/20",
          readOnly ? "cursor-default opacity-75" : "focus:border-[var(--accent)]/40",
        ].join(" ")}
      />
    </div>
  );
}

function TeamStatsCard({
  title,
  players,
  stats,
  setPlayerStat,
  readOnly,
}: {
  title: string;
  players: Player[];
  stats: Record<string, { goals: string; assists: string }>;
  setPlayerStat: (playerId: string, key: "goals" | "assists", value: string) => void;
  readOnly?: boolean;
}) {
  return (
    <section className="rounded-[28px] border border-white/8 bg-[var(--card)]/95 p-4 md:p-5 shadow-2xl shadow-black/20">
      <div className="mb-4 text-lg md:text-xl font-black text-[var(--foreground)]">{title}</div>

      {players.length === 0 ? (
        <div className="rounded-2xl bg-white/[0.04] px-4 py-4 text-[var(--foreground)]/55">
          Nessun giocatore disponibile.
        </div>
      ) : (
        <div className="space-y-3">
          {players.map((p) => (
            <div
              key={p.id}
              className="rounded-2xl border border-white/8 bg-white/[0.03] p-4"
            >
              <div className="min-w-0">
                <div className="text-base md:text-lg font-bold text-[var(--foreground)] break-words">
                  #{p.number} {p.firstName} {p.lastName}
                </div>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-[var(--foreground)]/40">
                    Gol
                  </div>
                  <input
                    value={stats[p.id]?.goals ?? ""}
                    placeholder="0"
                    onChange={(e) => !readOnly && setPlayerStat(p.id, "goals", e.target.value)}
                    inputMode="numeric"
                    readOnly={readOnly}
                    className={["h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center font-bold text-[var(--foreground)] outline-none", readOnly ? "cursor-default opacity-75" : "focus:border-[var(--accent)]/40"].join(" ")}
                  />
                </div>

                <div>
                  <div className="mb-1 text-xs uppercase tracking-[0.16em] text-[var(--foreground)]/40">
                    Assist
                  </div>
                  <input
                    value={stats[p.id]?.assists ?? ""}
                    placeholder="0"
                    onChange={(e) => !readOnly && setPlayerStat(p.id, "assists", e.target.value)}
                    inputMode="numeric"
                    readOnly={readOnly}
                    className={["h-11 w-full rounded-xl border border-white/10 bg-white/5 px-3 text-center font-bold text-[var(--foreground)] outline-none", readOnly ? "cursor-default opacity-75" : "focus:border-[var(--accent)]/40"].join(" ")}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}