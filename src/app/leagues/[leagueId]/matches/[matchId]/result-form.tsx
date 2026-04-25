"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
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
  date: string | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
  stats: StatRow[];
  leagueId: string;
};

function TeamCrest({ name, size = 40 }: { name: string; size?: number }) {
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const hue = (initials.charCodeAt(0) * 47 + initials.charCodeAt(1) * 13) % 360;
  return (
    <div
      className="flex shrink-0 items-center justify-center font-bold"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.28,
        background: `oklch(0.88 0.07 ${hue})`,
        color: `oklch(0.38 0.12 ${hue})`,
        fontSize: size * 0.36,
        fontFamily: "var(--font-display)",
      }}
    >
      {initials}
    </div>
  );
}

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

  // date scheduling
  const toLocalDatetimeValue = (iso: string | null) => {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    // datetime-local needs "YYYY-MM-DDTHH:mm"
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };

  const [dateValue, setDateValue] = useState(() => toLocalDatetimeValue(match.date));
  const [savingDate, setSavingDate] = useState(false);
  const [dateMsg, setDateMsg] = useState<string | null>(null);
  const [dateErr, setDateErr] = useState<string | null>(null);

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

  async function saveDate(clear = false) {
    setDateErr(null);
    setDateMsg(null);
    setSavingDate(true);
    try {
      const res = await authFetch(`/api/matches/${match.id}/date`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ date: clear ? null : (dateValue ? new Date(dateValue).toISOString() : null) }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error((data as any)?.error ?? "Errore salvataggio data");
      if (clear) setDateValue("");
      setDateMsg(clear ? "Data rimossa" : "Data salvata");
      router.refresh();
    } catch (e: any) {
      setDateErr(e.message);
    } finally {
      setSavingDate(false);
    }
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

  const played = homeGoals !== "" && awayGoals !== "";
  const hg = Number(homeGoals);
  const ag = Number(awayGoals);

  return (
    <DashboardShell leagueId={match.leagueId}>
      <div className="mx-auto w-full max-w-[560px] space-y-4 pb-8">

        {/* Back + round */}
        <div className="flex items-center gap-2 pt-1">
          <Link
            href={`/leagues/${match.leagueId}/calendar`}
            className="flex items-center gap-1 text-sm text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          >
            <ChevronLeft size={16} />
            Calendario
          </Link>
          <span className="text-[var(--border-strong)]">·</span>
          <span
            className="text-sm text-[var(--muted)]"
            style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
          >
            Giornata {match.round}
          </span>
        </div>

        {/* Date scheduling — only for authorised users */}
        {canEdit && (
          <div className="rounded-[14px] border border-[var(--border)] bg-[var(--card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]">
            <p className="mb-2.5 text-[11px] font-semibold uppercase tracking-wider text-[var(--muted)]" style={{ fontFamily: "var(--font-display)" }}>
              Data e ora
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="datetime-local"
                value={dateValue}
                onChange={(e) => setDateValue(e.target.value)}
                className="h-9 flex-1 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-3 text-[13px] text-[var(--foreground)] outline-none transition-colors focus:border-[var(--accent)] focus:bg-[var(--card)]"
                style={{ fontFamily: "var(--font-mono, ui-monospace)", minWidth: 180 }}
              />
              <button
                onClick={() => saveDate(false)}
                disabled={savingDate || !dateValue}
                className="h-9 rounded-xl bg-[var(--accent)] px-3 text-[13px] font-semibold text-white transition-opacity disabled:opacity-40"
              >
                {savingDate ? "…" : "Salva"}
              </button>
              {dateValue && (
                <button
                  onClick={() => saveDate(true)}
                  disabled={savingDate}
                  className="h-9 rounded-xl border border-red-200 bg-red-50 px-3 text-[13px] font-medium text-red-600 transition-colors hover:bg-red-100 disabled:opacity-40"
                >
                  Rimuovi
                </button>
              )}
            </div>
            {dateMsg && <p className="mt-2 text-[12px] font-medium text-emerald-700">{dateMsg}</p>}
            {dateErr && <p className="mt-2 text-[12px] font-medium text-red-600">{dateErr}</p>}
          </div>
        )}

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {/* Scoreboard */}
        <Card>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 py-2">
            {/* Home */}
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamCrest name={match.homeTeam.name} size={44} />
              <span
                className={[
                  "text-[13px] font-semibold leading-tight",
                  played && hg < ag ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                ].join(" ")}
              >
                {match.homeTeam.name}
              </span>
            </div>

            {/* Score */}
            <div className="flex flex-col items-center gap-3">
              <div
                className="flex items-center gap-1"
                style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
              >
                <input
                  value={homeGoals}
                  onChange={(e) => canEdit && setHomeGoals(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="–"
                  inputMode="numeric"
                  readOnly={!canEdit}
                  className={[
                    "w-14 rounded-[10px] border text-center text-[40px] font-semibold leading-none tabular-nums text-[var(--foreground)] outline-none transition-colors",
                    "placeholder:text-[var(--border-strong)]",
                    canEdit
                      ? "border-[var(--border)] bg-[var(--card-2)] focus:border-[var(--accent)] focus:bg-[var(--card)]"
                      : "cursor-default border-transparent bg-transparent",
                  ].join(" ")}
                  style={{ height: 60, fontFamily: "var(--font-mono, ui-monospace)" }}
                />
                <span
                  className="text-[28px] font-light text-[var(--border-strong)] select-none"
                  style={{ fontFamily: "var(--font-mono, ui-monospace)", lineHeight: 1 }}
                >
                  :
                </span>
                <input
                  value={awayGoals}
                  onChange={(e) => canEdit && setAwayGoals(e.target.value.replace(/[^\d]/g, ""))}
                  placeholder="–"
                  inputMode="numeric"
                  readOnly={!canEdit}
                  className={[
                    "w-14 rounded-[10px] border text-center text-[40px] font-semibold leading-none tabular-nums text-[var(--foreground)] outline-none transition-colors",
                    "placeholder:text-[var(--border-strong)]",
                    canEdit
                      ? "border-[var(--border)] bg-[var(--card-2)] focus:border-[var(--accent)] focus:bg-[var(--card)]"
                      : "cursor-default border-transparent bg-transparent",
                  ].join(" ")}
                  style={{ height: 60, fontFamily: "var(--font-mono, ui-monospace)" }}
                />
              </div>

              {played && (
                <span
                  className="rounded-full px-2.5 py-0.5 text-[11px] font-medium"
                  style={{
                    background: "var(--card-2)",
                    color: "var(--muted)",
                    fontFamily: "var(--font-display)",
                  }}
                >
                  {hg > ag ? match.homeTeam.name.split(" ")[0] + " vince" : hg < ag ? match.awayTeam.name.split(" ")[0] + " vince" : "Pareggio"}
                </span>
              )}
            </div>

            {/* Away */}
            <div className="flex flex-col items-center gap-2 text-center">
              <TeamCrest name={match.awayTeam.name} size={44} />
              <span
                className={[
                  "text-[13px] font-semibold leading-tight",
                  played && ag < hg ? "text-[var(--muted)]" : "text-[var(--foreground)]",
                ].join(" ")}
              >
                {match.awayTeam.name}
              </span>
            </div>
          </div>
        </Card>

        {!canEdit && !authLoading && (
          <p className="px-1 text-sm text-[var(--muted)]">
            Sola lettura — accedi come admin o capitano per modificare.
          </p>
        )}

        {/* Player stats */}
        <div className="grid gap-4 xl:grid-cols-2">
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

        {/* Save */}
        {canEdit && (
          <div className="flex items-center justify-between gap-4 rounded-[14px] bg-[var(--card)] px-4 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)]">
            <div
              className="flex gap-4 text-sm text-[var(--muted)]"
              style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
            >
              <span>
                <span className="text-[var(--foreground)] font-semibold">{totals.goalsSum}</span>
                {" "}gol
              </span>
              <span>
                <span className="text-[var(--foreground)] font-semibold">{totals.assistsSum}</span>
                {" "}assist
              </span>
            </div>
            <Button onClick={save} disabled={saving}>
              {saving ? "Salvataggio…" : "Salva"}
            </Button>
          </div>
        )}

      </div>
    </DashboardShell>
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
    <Card className="!p-0 overflow-hidden">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <h2 className="text-[13px] font-semibold text-[var(--foreground)]">{title}</h2>
      </div>

      {players.length === 0 ? (
        <p className="px-4 py-4 text-sm text-[var(--muted)]">Nessun giocatore.</p>
      ) : (
        <div>
          {players.map((p, i) => {
            const hasStats =
              Number(stats[p.id]?.goals || 0) > 0 || Number(stats[p.id]?.assists || 0) > 0;
            return (
              <div
                key={p.id}
                className={[
                  "grid items-center gap-3 px-4 py-2.5",
                  i < players.length - 1 ? "border-b border-[var(--border)]" : "",
                  hasStats ? "bg-[oklch(0.97_0.01_258)]" : "",
                ].join(" ")}
                style={{ gridTemplateColumns: "28px 1fr auto" }}
              >
                {/* Jersey number */}
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[11px] font-medium tabular-nums text-[var(--muted)]"
                  style={{ background: "var(--card-2)", fontFamily: "var(--font-mono, ui-monospace)" }}
                >
                  {p.number}
                </div>

                {/* Name */}
                <span className="min-w-0 truncate text-[13px] font-medium text-[var(--foreground)]">
                  {p.firstName} {p.lastName}
                </span>

                {/* Inputs */}
                <div className="flex items-center gap-1.5">
                  <StatInput
                    label="G"
                    value={stats[p.id]?.goals ?? ""}
                    onChange={(v) => setPlayerStat(p.id, "goals", v)}
                    readOnly={readOnly}
                  />
                  <StatInput
                    label="A"
                    value={stats[p.id]?.assists ?? ""}
                    onChange={(v) => setPlayerStat(p.id, "assists", v)}
                    readOnly={readOnly}
                  />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function StatInput({
  label, value, onChange, readOnly,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  readOnly?: boolean;
}) {
  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] font-medium text-[var(--muted)] w-3">{label}</span>
      <input
        value={value === "0" ? "" : value}
        placeholder="0"
        onChange={(e) => !readOnly && onChange(e.target.value)}
        inputMode="numeric"
        readOnly={readOnly}
        className={[
          "h-8 w-10 rounded-lg border text-center text-[13px] font-semibold tabular-nums text-[var(--foreground)] outline-none transition-colors placeholder:text-[var(--border-strong)]",
          readOnly
            ? "cursor-default border-transparent bg-transparent"
            : "border-[var(--border)] bg-[var(--card-2)] focus:border-[var(--accent)] focus:bg-[var(--card)]",
        ].join(" ")}
        style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
      />
    </div>
  );
}
