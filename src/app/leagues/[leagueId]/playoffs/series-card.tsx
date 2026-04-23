"use client";

import Link from "next/link";

type Team = { id: string; name: string; badgeUrl?: string | null };

type Match = {
  id: string;
  leg: number | null;
  homeGoals: number | null;
  awayGoals: number | null;
  homeTeamId: string;
  awayTeamId: string;
};

export type SeriesData = {
  id: string;
  bracketRound: number;
  position: number;
  homeTeam: Team | null;
  awayTeam: Team | null;
  homeSeed: number | null;
  awaySeed: number | null;
  winnerId: string | null;
  matches: Match[];
};

type Props = {
  series: SeriesData;
  leagueId: string;
  format: string;
};

export default function SeriesCard({ series, leagueId, format }: Props) {
  const { homeTeam, awayTeam, winnerId, matches } = series;

  const leg1 = matches.find((m) => m.leg === 1);
  const leg2 = matches.find((m) => m.leg === 2);

  const homeWon = winnerId && homeTeam && winnerId === homeTeam.id;
  const awayWon = winnerId && awayTeam && winnerId === awayTeam.id;

  return (
    <div
      className={[
        "w-[220px] rounded-2xl border shadow-lg shadow-black/20 transition-all duration-500",
        winnerId
          ? "border-[var(--accent)]/30 bg-[var(--card)]"
          : "border-white/10 bg-[var(--card)]/95",
      ].join(" ")}
    >
      {/* Home team row */}
      <TeamRow
        seed={series.homeSeed}
        name={homeTeam?.name ?? null}
        won={!!homeWon}
        lost={!!awayWon}
        leg1Score={leg1?.homeGoals ?? null}
        leg2Score={format === "TWO_LEG" ? (leg2?.awayGoals ?? null) : null}
        isTwoLeg={format === "TWO_LEG"}
        border
      />

      {/* Away team row */}
      <TeamRow
        seed={series.awaySeed}
        name={awayTeam?.name ?? null}
        won={!!awayWon}
        lost={!!homeWon}
        leg1Score={leg1?.awayGoals ?? null}
        leg2Score={format === "TWO_LEG" ? (leg2?.homeGoals ?? null) : null}
        isTwoLeg={format === "TWO_LEG"}
      />

      {/* Action link */}
      {homeTeam && awayTeam && !winnerId && matches.length > 0 && (
        <div className="border-t border-white/8 px-3 py-2">
          <div className="flex gap-2">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/leagues/${leagueId}/matches/${m.id}`}
                className="flex-1 rounded-xl bg-white/5 px-2 py-1.5 text-center text-xs font-medium text-[var(--accent)] hover:bg-white/10"
              >
                {m.homeGoals !== null ? "Modifica" : "Risultato"}
                {format === "TWO_LEG" ? ` G${m.leg}` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Winner badge */}
      {winnerId && (
        <div className="animate-fade-in border-t border-white/8 px-3 py-1.5 text-center text-[10px] font-bold uppercase tracking-[0.15em] text-[var(--accent)]">
          Qualificato
        </div>
      )}
    </div>
  );
}

function TeamRow({
  seed,
  name,
  won,
  lost,
  leg1Score,
  leg2Score,
  isTwoLeg,
  border = false,
}: {
  seed: number | null;
  name: string | null;
  won: boolean;
  lost: boolean;
  leg1Score: number | null;
  leg2Score: number | null;
  isTwoLeg: boolean;
  border?: boolean;
}) {
  return (
    <div
      className={[
        "flex items-center gap-2 px-3 py-2.5 transition-colors duration-500",
        border ? "border-b border-white/8" : "",
        won ? "bg-[var(--accent)]/10" : "",
        lost ? "opacity-50" : "",
      ].join(" ")}
    >
      {seed && (
        <span className="w-5 text-center text-xs font-medium text-[var(--foreground)]/40">
          {seed}
        </span>
      )}
      <span
        className={[
          "flex-1 truncate text-sm font-semibold transition-colors duration-500",
          won
            ? "text-[var(--accent)]"
            : name
              ? "text-[var(--foreground)]"
              : "text-[var(--foreground)]/30 italic",
        ].join(" ")}
      >
        {name ?? "TBD"}
      </span>
      <ScoreDisplay
        leg1Score={leg1Score}
        leg2Score={leg2Score}
        isTwoLeg={isTwoLeg}
      />
    </div>
  );
}

function ScoreDisplay({
  leg1Score,
  leg2Score,
  isTwoLeg,
}: {
  leg1Score: number | null;
  leg2Score: number | null;
  isTwoLeg: boolean;
}) {
  if (leg1Score === null && leg2Score === null) {
    return <span className="text-xs text-[var(--foreground)]/25">-</span>;
  }

  if (isTwoLeg) {
    return (
      <div className="flex gap-1 text-sm font-bold text-[var(--foreground)]">
        <span>{leg1Score ?? "-"}</span>
        <span className="text-[var(--foreground)]/25">|</span>
        <span>{leg2Score ?? "-"}</span>
      </div>
    );
  }

  return (
    <span className="text-sm font-bold text-[var(--foreground)]">
      {leg1Score ?? "-"}
    </span>
  );
}
