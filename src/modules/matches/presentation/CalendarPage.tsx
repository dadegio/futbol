"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  MapPin,
  RefreshCw,
  UsersRound,
  Wand2,
} from "lucide-react";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";
import Button from "src/app/_components/ui/button";
import Input from "src/app/_components/ui/input";
import Select from "src/app/_components/ui/select";
import SponsorBanner from "src/app/_components/sponsor-banner";
import { authFetch, useAuth } from "@/lib/client-auth";

type Team = {
  id: string;
  name: string;
  badgeUrl: string | null;
};

type Match = {
  id: string;
  leagueId: string;
  round: number;
  date: string | null;
  slotEnd: string | null;
  venueKey: string | null;
  venueName: string | null;
  venueAddress: string | null;
  referee: {
    id: string;
    name: string | null;
  } | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
};

type Filter = "all" | "pending" | "played";

type GeneratorResult = {
  created: number;
  rounds: number;
  scheduled: boolean;
  schedulingMode: "captain_booking" | "fixed_slots";
};

async function getJSON<T>(url: string): Promise<T> {
  const res = await authFetch(url, { cache: "no-store" });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error((data as any)?.error ?? "Errore");
  }

  return data as T;
}

function isPlayed(match: Match) {
  return match.homeGoals !== null && match.awayGoals !== null;
}

function isToday(date: Date) {
  const now = new Date();

  return (
    date.getFullYear() === now.getFullYear() &&
    date.getMonth() === now.getMonth() &&
    date.getDate() === now.getDate()
  );
}

function isLiveMatch(match: Match) {
  if (!match.date) return false;

  const start = new Date(match.date);

  if (Number.isNaN(start.getTime())) return false;
  if (!isToday(start)) return false;

  const now = new Date();
  const end = new Date(start.getTime() + 77 * 60 * 1000);

  return now >= start && now <= end;
}

function getLiveMinute(match: Match) {
  if (!match.date) return null;

  const start = new Date(match.date);
  const now = new Date();

  if (Number.isNaN(start.getTime())) return null;

  const diffMinutes = Math.floor((now.getTime() - start.getTime()) / 60000);

  if (diffMinutes < 0 || diffMinutes > 77) return null;
  if (diffMinutes <= 30) return `${diffMinutes}'`;
  if (diffMinutes <= 32) return "30'+";
  if (diffMinutes <= 62) return `${diffMinutes - 2}'`;

  return "60'+";
}

function formatTime(date: string | null) {
  if (!date) return "—";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "—";

  return parsed.toLocaleTimeString("it-IT", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getDayKey(match: Match) {
  if (!match.date) return `round-${match.round}`;

  const parsed = new Date(match.date);

  if (Number.isNaN(parsed.getTime())) {
    return `round-${match.round}`;
  }

  return parsed.toISOString().slice(0, 10);
}

function formatDayTitle(date: string | null) {
  if (!date) return "DATA DA DEFINIRE";

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) return "DATA DA DEFINIRE";
  if (isToday(parsed)) return "OGGI";

  const weekday = parsed
    .toLocaleDateString("it-IT", { weekday: "short" })
    .toUpperCase()
    .replace(".", "");

  const day = parsed.toLocaleDateString("it-IT", { day: "2-digit" });

  const month = parsed
    .toLocaleDateString("it-IT", { month: "short" })
    .toUpperCase()
    .replace(".", "");

  return `${weekday} ${day} ${month}`;
}

function toDatetimeLocalValue(date: Date) {
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}

export default function CalendarPage({
  leagueId,
  initialMatches,
  initialTeamCount,
}: {
  leagueId: string;
  initialMatches: Match[];
  initialTeamCount: number;
}) {
  const { user } = useAuth();
  const isAdmin = user?.role === "ADMIN" || (user?.role === "LEAGUE_ADMIN" && user.leagueId === leagueId);

  const [matches, setMatches] = useState<Match[]>(initialMatches);
  const [teamCount, setTeamCount] = useState(initialTeamCount);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  const [doubleRound, setDoubleRound] = useState(true);
  const [random, setRandom] = useState(true);
  const [alternateHomeAway, setAlternateHomeAway] = useState(true);
  const [seed, setSeed] = useState("");
  const [schedulingMode, setSchedulingMode] = useState<
    "captain_booking" | "fixed_slots"
  >("captain_booking");
  const [firstDateTime, setFirstDateTime] = useState(() => {
    const next = new Date();
    next.setDate(next.getDate() + 7);
    next.setHours(20, 0, 0, 0);
    return toDatetimeLocalValue(next);
  });
  const [generating, setGenerating] = useState(false);

  async function load() {
    setErr(null);
    setLoading(true);

    try {
      const [matchData, teamData] = await Promise.all([
        getJSON<Match[]>(`/api/leagues/${leagueId}/schedule`),
        getJSON<Team[]>(`/api/leagues/${leagueId}/teams`),
      ]);
      setMatches(matchData);
      setTeamCount(teamData.length);
    } catch (error: any) {
      setErr(error.message ?? "Errore caricamento calendario");
    } finally {
      setLoading(false);
    }
  }

  const rounds = useMemo(
    () =>
      [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b),
    [matches]
  );

  const matchesPerRound = Math.floor(teamCount / 2);
  const roundsPerLeg =
    teamCount < 2 ? 0 : teamCount % 2 === 0 ? teamCount - 1 : teamCount;

  const currentRound = useMemo(() => {
    if (rounds.length === 0) return null;

    for (const round of rounds) {
      const roundMatches = matches.filter((match) => match.round === round);
      const allPlayed =
        roundMatches.length > 0 &&
        roundMatches.every((match) => isPlayed(match));

      if (!allPlayed) return round;
    }

    return rounds[rounds.length - 1] ?? null;
  }, [matches, rounds]);

  useEffect(() => {
    if (currentRound === null) {
      setSelectedRound(null);
      return;
    }

    if (selectedRound !== null && rounds.includes(selectedRound)) return;

    setSelectedRound(currentRound);
  }, [currentRound, rounds, selectedRound]);

  const visibleRound = selectedRound ?? currentRound;

  const filteredMatches = useMemo(() => {
    let output = matches;

    if (visibleRound) {
      output = output.filter((match) => match.round === visibleRound);
    }

    if (filter === "played") {
      output = output.filter((match) => isPlayed(match));
    }

    if (filter === "pending") {
      output = output.filter((match) => !isPlayed(match));
    }

    return [...output].sort((a, b) => {
      const aDate = a.date ? new Date(a.date).getTime() : 0;
      const bDate = b.date ? new Date(b.date).getTime() : 0;

      return aDate - bDate;
    });
  }, [matches, visibleRound, filter]);

  const grouped = useMemo(() => {
    const map = new Map<string, { title: string; matches: Match[] }>();

    for (const match of filteredMatches) {
      const key = getDayKey(match);

      if (!map.has(key)) {
        map.set(key, {
          title: formatDayTitle(match.date),
          matches: [],
        });
      }

      map.get(key)!.matches.push(match);
    }

    return [...map.values()];
  }, [filteredMatches]);

  async function generateCalendar(replace: boolean) {
    if (!leagueId) return;

    setErr(null);
    setMsg(null);
    setGenerating(true);

    try {
      const res = await authFetch(`/api/leagues/${leagueId}/schedule`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          replace,
          doubleRound,
          random,
          alternateHomeAway,
          seed: seed.trim() || null,
          schedulingMode,
          firstDateTime: firstDateTime
            ? new Date(firstDateTime).toISOString()
            : null,
        }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error((data as any)?.error ?? "Errore generazione calendario");
      }

      const result = data as GeneratorResult;
      setMsg(
        `Calendario generato: ${result.created} partite in ${result.rounds} giornate${
          result.scheduled
            ? " con campi e orari assegnati automaticamente"
            : "; i capitani possono ora prenotare gli slot liberi"
        }.`
      );
      setSelectedRound(null);
      await load();
    } catch (error: any) {
      setErr(error.message ?? "Errore generazione calendario");
    } finally {
      setGenerating(false);
    }
  }

  function goToPreviousRound() {
    if (!visibleRound) return;

    const index = rounds.indexOf(visibleRound);
    const previous = rounds[index - 1];

    if (previous) setSelectedRound(previous);
  }

  function goToNextRound() {
    if (!visibleRound) return;

    const index = rounds.indexOf(visibleRound);
    const next = rounds[index + 1];

    if (next) setSelectedRound(next);
  }

  if (!leagueId) return <div>Caricamento…</div>;

  return (
    <DashboardShell leagueId={leagueId}>
      <div className="w-full space-y-5 pb-8">
        <header className="pt-2">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
                Calendario
              </h1>
              <p className="mt-1 text-sm text-[var(--muted)]">
                {loading
                  ? "Caricamento partite…"
                  : `${matches.length} partite · ${rounds.length} giornate`}
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={goToPreviousRound}
                disabled={!visibleRound || rounds.indexOf(visibleRound) <= 0}
                className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--card)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)] disabled:opacity-40"
              >
                <ChevronLeft size={18} />
              </button>

              <span className="text-sm font-black text-[var(--foreground)]">
                G{visibleRound ?? "—"}
              </span>

              <button
                type="button"
                onClick={goToNextRound}
                disabled={
                  !visibleRound ||
                  rounds.indexOf(visibleRound) >= rounds.length - 1
                }
                className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--card)] text-[var(--foreground)] shadow-[0_1px_3px_rgba(0,0,0,0.05),0_0_0_1px_rgba(0,0,0,0.04)] disabled:opacity-40"
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
        </header>

        <SponsorBanner compact />

        {isAdmin && (
          <Card className="space-y-4">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Wand2 size={18} className="text-[var(--accent)]" />
                  <h2 className="text-lg font-black tracking-[-0.04em] text-[var(--foreground)]">
                    Generatore calendario
                  </h2>
                </div>
                <p className="mt-1 max-w-2xl text-sm leading-relaxed text-[var(--muted)]">
                  {teamCount >= 2 ? (
                    <>
                      Il calendario userà tutte le {teamCount} squadre attive
                      del torneo: {matchesPerRound}{" "}
                      {matchesPerRound === 1 ? "partita" : "partite"} per
                      giornata e {roundsPerLeg}{" "}
                      {roundsPerLeg === 1 ? "giornata" : "giornate"} per
                      girone
                      {teamCount % 2 === 1
                        ? ", con una squadra a riposo in ogni giornata"
                        : ""}
                      .
                    </>
                  ) : (
                    <>Aggiungi almeno due squadre attive per creare il calendario.</>
                  )}{" "}
                  La rigenerazione è bloccata se esistono risultati,
                  statistiche o distinte già compilate.
                </p>
              </div>

              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  onClick={() => generateCalendar(false)}
                  disabled={
                    generating || loading || teamCount < 2 || matches.length > 0
                  }
                >
                  {generating ? "Genero…" : "Genera calendario"}
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => generateCalendar(true)}
                  disabled={
                    generating || loading || teamCount < 2 || matches.length === 0
                  }
                >
                  <RefreshCw size={15} />
                  Rigenera
                </Button>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)] md:col-span-2">
                Assegnazione campi
                <Select
                  value={schedulingMode}
                  onChange={(event) =>
                    setSchedulingMode(
                      event.target.value as "captain_booking" | "fixed_slots"
                    )
                  }
                >
                  <option value="captain_booking" className="text-black">
                    I capitani prenotano gli slot liberi
                  </option>
                  <option value="fixed_slots" className="text-black">
                    Assegna automaticamente i campi fissi
                  </option>
                </Select>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
                Inizio programmazione
                <Input
                  type="datetime-local"
                  value={firstDateTime}
                  onChange={(event) => setFirstDateTime(event.target.value)}
                  required
                />
                <span className="block text-xs font-normal text-[var(--muted)]">
                  Definisce la settimana della giornata 1 anche quando
                  prenotano i capitani.
                </span>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
                Formula
                <Select
                  value={doubleRound ? "double" : "single"}
                  onChange={(event) => setDoubleRound(event.target.value === "double")}
                >
                  <option value="single" className="text-black">Solo andata</option>
                  <option value="double" className="text-black">Andata e ritorno</option>
                </Select>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
                Ordine squadre
                <Select
                  value={random ? "random" : "created"}
                  onChange={(event) => setRandom(event.target.value === "random")}
                >
                  <option value="random" className="text-black">Casuale</option>
                  <option value="created" className="text-black">Ordine iscrizione</option>
                </Select>
              </label>

              <label className="space-y-1.5 text-sm font-semibold text-[var(--foreground)]">
                Seed opzionale
                <Input
                  value={seed}
                  onChange={(event) => setSeed(event.target.value.replace(/[^0-9]/g, ""))}
                  placeholder="es. 2026"
                  inputMode="numeric"
                />
              </label>

              <label className="flex items-center gap-2 self-end rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3 text-sm font-semibold text-[var(--foreground)]">
                <input
                  type="checkbox"
                  checked={alternateHomeAway}
                  onChange={(event) => setAlternateHomeAway(event.target.checked)}
                />
                Alterna casa/trasferta
              </label>
            </div>

            <div className="rounded-2xl border border-[var(--border)] bg-[var(--card-2)] px-4 py-3">
              <p className="text-xs font-black uppercase tracking-[0.16em] text-[var(--accent)]">
                Slot settimanali configurati
              </p>
              <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
                Martedì 21:00 · Anastasio Germonio — Mercoledì 20:00 e 21:00 ·
                Anastasio Germonio e Sant&apos;Ignazio — Mercoledì 21:00 e
                giovedì 21:00 · Circolo della Stampa.
              </p>
            </div>
          </Card>
        )}

        <div className="flex gap-8 border-b border-[var(--border)] text-base">
          <CalendarTab label="Tutte" active={filter === "all"} onClick={() => setFilter("all")} />
          <CalendarTab label="Prossime" active={filter === "pending"} onClick={() => setFilter("pending")} />
          <CalendarTab label="Concluse" active={filter === "played"} onClick={() => setFilter("played")} />
        </div>

        {msg && <Badge variant="success">{msg}</Badge>}
        {err && <Badge variant="error">{err}</Badge>}

        {loading && <CalendarSkeleton />}

        {!loading && matches.length === 0 && (
          <Card>
            <p className="font-medium text-[var(--foreground)]">Nessuna partita</p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Il calendario non è ancora disponibile.
            </p>
          </Card>
        )}

        {!loading && matches.length > 0 && grouped.length === 0 && (
          <Card>
            <p className="text-sm text-[var(--muted)]">Nessuna partita per questo filtro.</p>
          </Card>
        )}

        {!loading && grouped.length > 0 && (
          <div className="space-y-6">
            {grouped.map((group) => (
              <section key={group.title}>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-[-0.01em] text-[var(--foreground)]">
                    {group.title}
                  </h2>

                  <span className="font-mono text-sm text-[var(--muted)]">
                    {group.matches.length} {group.matches.length === 1 ? "partita" : "partite"}
                  </span>
                </div>

                <Card className="overflow-hidden !p-0">
                  {group.matches.map((match) => (
                    <CalendarMatchRow key={match.id} leagueId={leagueId} match={match} />
                  ))}
                </Card>
              </section>
            ))}
          </div>
        )}
      </div>
    </DashboardShell>
  );
}

function CalendarTab({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "pb-3 font-medium",
        active ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]" : "text-[var(--muted)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function CalendarSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-label="Caricamento calendario">
      {[0, 1].map((group) => (
        <section key={group} className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="h-4 w-28 animate-pulse rounded-full bg-[var(--card-2)]" />
            <div className="h-4 w-16 animate-pulse rounded-full bg-[var(--card-2)]" />
          </div>
          <Card className="overflow-hidden !p-0">
            {[0, 1, 2].map((row) => (
              <div key={row} className="grid grid-cols-[58px_minmax(0,1fr)_auto_18px] items-center gap-2 border-b border-[var(--border)] px-3 py-4 last:border-b-0">
                <div className="mx-auto h-5 w-10 animate-pulse rounded-full bg-[var(--card-2)]" />
                <div className="space-y-3">
                  <div className="h-5 w-2/3 animate-pulse rounded-full bg-[var(--card-2)]" />
                  <div className="h-5 w-1/2 animate-pulse rounded-full bg-[var(--card-2)]" />
                </div>
                <div className="h-5 w-5 animate-pulse rounded-full bg-[var(--card-2)]" />
                <div className="h-5 w-3 animate-pulse rounded-full bg-[var(--card-2)]" />
              </div>
            ))}
          </Card>
        </section>
      ))}
    </div>
  );
}

function CalendarMatchRow({ leagueId, match }: { leagueId: string; match: Match }) {
  const played = isPlayed(match);
  const live = isLiveMatch(match);
  const liveMinute = getLiveMinute(match);

  return (
    <Link
      href={`/leagues/${leagueId}/matches/${match.id}`}
      className="grid grid-cols-[58px_minmax(0,1fr)_auto_18px] items-center gap-2 border-b border-[var(--border)] px-3 py-4 last:border-b-0 active:bg-black/[0.02]"
    >
      <div className="text-center">
        {live ? (
          <div className="text-xs font-semibold text-[var(--danger)]">
            <span className="mx-auto mb-1 block h-1.5 w-1.5 rounded-full bg-[var(--danger)]" />
            {liveMinute ?? "Live"}
          </div>
        ) : played ? (
          <span className="text-sm font-medium text-[var(--muted)]">FT</span>
        ) : (
          <span className="font-mono text-sm font-black text-[var(--foreground)]">
            {formatTime(match.date)}
          </span>
        )}
      </div>

      <div className="min-w-0 space-y-2">
        <TeamLine team={match.homeTeam} muted={played && !live} />
        <TeamLine team={match.awayTeam} muted={played && !live} />
        <div className="flex min-w-0 flex-col gap-1 pt-1 text-[11px] font-semibold text-[var(--muted)] sm:flex-row sm:flex-wrap sm:gap-x-4">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={12} className="shrink-0 text-[var(--accent)]" />
            <span className="truncate">
              {match.venueName
                ? `${match.venueName}${match.venueAddress ? ` · ${match.venueAddress}` : ""}`
                : "Campo da prenotare"}
            </span>
          </span>
          <span className="flex min-w-0 items-center gap-1.5">
            <UsersRound size={12} className="shrink-0 text-[var(--accent)]" />
            <span className="truncate">
              Arbitro: {match.referee ? (match.referee.name || "assegnato") : "da assegnare"}
            </span>
          </span>
        </div>
      </div>

      <div className="w-6 space-y-2 text-right text-sm font-black text-[var(--foreground)]">
        {played && (
          <>
            <div>{match.homeGoals}</div>
            <div>{match.awayGoals}</div>
          </>
        )}
      </div>

      <span className="text-xl text-[var(--muted)]">›</span>
    </Link>
  );
}

function TeamLine({ team, muted }: { team: Team; muted?: boolean }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <TeamLogo name={team.name} badgeUrl={team.badgeUrl} />

      <span
        className={[
          "min-w-0 break-words text-[15px] font-semibold leading-snug",
          muted ? "text-[var(--muted)]" : "text-[var(--foreground)]",
        ].join(" ")}
      >
        {team.name}
      </span>
    </div>
  );
}

function TeamLogo({ name, badgeUrl }: { name: string; badgeUrl: string | null }) {
  const initials = name
    .split(" ")
    .map((word) => word[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  if (badgeUrl) {
    return (
      <img
        src={badgeUrl}
        alt={`Logo ${name}`}
        className="h-6 w-6 shrink-0 rounded-md object-contain"
      />
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-[#eef0ec] text-[9px] font-black text-[var(--foreground)]">
      {initials}
    </span>
  );
}
