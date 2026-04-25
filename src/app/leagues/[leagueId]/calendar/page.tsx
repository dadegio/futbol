"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useParams } from "next/navigation";
import DashboardShell from "src/app/_components/dashboard-shell";
import Card from "src/app/_components/ui/card";
import Badge from "src/app/_components/ui/badge";

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
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeam: Team;
  awayTeam: Team;
};

type Filter = "all" | "pending" | "played";

async function getJSON<T>(url: string): Promise<T> {
  const res = await fetch(url, { cache: "no-store" });
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
  // 60 min match + 2 min break + 15 min post-match grace = 77 min live window.
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
  if (diffMinutes <= 32) return "30'+";  // half-time break
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

export default function CalendarPage() {
  const { leagueId } = useParams<{ leagueId: string }>();

  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);

  const [filter, setFilter] = useState<Filter>("all");
  const [selectedRound, setSelectedRound] = useState<number | null>(null);

  useEffect(() => {
    if (!leagueId) return;

    async function load() {
      setErr(null);
      setLoading(true);

      try {
        const data = await getJSON<Match[]>(`/api/leagues/${leagueId}/schedule`);
        setMatches(data);
      } catch (error: any) {
        setErr(error.message);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [leagueId]);

  const rounds = useMemo(
    () =>
      [...new Set(matches.map((match) => match.round))].sort((a, b) => a - b),
    [matches]
  );

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
    if (selectedRound !== null) return;
    if (currentRound === null) return;

    setSelectedRound(currentRound);
  }, [currentRound, selectedRound]);

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
    const map = new Map<
      string,
      {
        title: string;
        matches: Match[];
      }
    >();

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
            <h1 className="text-[31px] font-black tracking-[-0.06em] text-[var(--foreground)]">
              Calendario
            </h1>

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

        <div className="flex gap-8 border-b border-[var(--border)] text-base">
          <CalendarTab
            label="Tutte"
            active={filter === "all"}
            onClick={() => setFilter("all")}
          />
          <CalendarTab
            label="Prossime"
            active={filter === "pending"}
            onClick={() => setFilter("pending")}
          />
          <CalendarTab
            label="Concluse"
            active={filter === "played"}
            onClick={() => setFilter("played")}
          />
        </div>

        {err && <Badge variant="error">{err}</Badge>}

        {loading && (
          <p className="text-sm text-[var(--muted)]">
            Caricamento calendario…
          </p>
        )}

        {!loading && matches.length === 0 && (
          <Card>
            <p className="font-medium text-[var(--foreground)]">
              Nessuna partita
            </p>
            <p className="mt-1 text-sm text-[var(--muted)]">
              Il calendario non è ancora disponibile.
            </p>
          </Card>
        )}

        {!loading && matches.length > 0 && grouped.length === 0 && (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              Nessuna partita per questo filtro.
            </p>
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
                    {group.matches.length}{" "}
                    {group.matches.length === 1 ? "partita" : "partite"}
                  </span>
                </div>

                <Card className="overflow-hidden !p-0">
                  {group.matches.map((match) => (
                    <CalendarMatchRow
                      key={match.id}
                      leagueId={leagueId}
                      match={match}
                    />
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

function CalendarTab({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "pb-3 font-medium",
        active
          ? "border-b-2 border-[var(--accent)] text-[var(--foreground)]"
          : "text-[var(--muted)]",
      ].join(" ")}
    >
      {label}
    </button>
  );
}

function CalendarMatchRow({
  leagueId,
  match,
}: {
  leagueId: string;
  match: Match;
}) {
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
          "min-w-0 truncate text-[15px] font-semibold",
          muted ? "text-[var(--muted)]" : "text-[var(--foreground)]",
        ].join(" ")}
      >
        {team.name}
      </span>
    </div>
  );
}

function TeamLogo({
  name,
  badgeUrl,
}: {
  name: string;
  badgeUrl: string | null;
}) {
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