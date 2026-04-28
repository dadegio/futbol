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
  penaltiesHome: number | null;
  penaltiesAway: number | null;
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
        "w-[220px] overflow-hidden rounded-2xl border shadow-[0_2px_8px_rgba(0,0,0,0.06)]",
        winnerId
          ? "border-[var(--accent)]/30 bg-[var(--card)]"
          : "border-[var(--border)] bg-[var(--card)]",
      ].join(" ")}
    >
      {/* Home team row */}
      <TeamRow
        seed={series.homeSeed}
        name={homeTeam?.name ?? null}
        badgeUrl = {homeTeam?.badgeUrl ?? null}
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
        badgeUrl = {awayTeam?.badgeUrl ?? null}
        won={!!awayWon}
        lost={!!homeWon}
        leg1Score={leg1?.awayGoals ?? null}
        leg2Score={format === "TWO_LEG" ? (leg2?.homeGoals ?? null) : null}
        isTwoLeg={format === "TWO_LEG"}
      />


      {/* Action link */}
      {homeTeam && awayTeam && !winnerId && matches.length > 0 && (
        <div className="border-t border-[var(--border)] px-3 py-2">
          <div className="flex gap-2">
            {matches.map((m) => (
              <Link
                key={m.id}
                href={`/leagues/${leagueId}/matches/${m.id}`}
                className="flex-1 rounded-xl border border-[var(--border)] bg-[var(--card-2)] px-2 py-1.5 text-center text-xs font-medium text-[var(--accent)] hover:bg-[var(--card)] transition-colors"
              >
                {m.homeGoals !== null ? "Modifica" : "Risultato"}
                {format === "TWO_LEG" ? ` G${m.leg}` : ""}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Penalties badge */}
      {series.penaltiesHome !== null && series.penaltiesAway !== null && (
        <div
          className="border-t border-[var(--border)] px-3 py-1.5 text-center text-[10px] font-semibold text-[var(--muted)]"
          style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
        >
          Rig. {series.penaltiesHome}–{series.penaltiesAway}
        </div>
      )}

      {/* Winner badge */}
      {winnerId && (
        <div className="animate-fade-in border-t border-[var(--border)] px-3 py-1.5 text-center text-[10px] font-semibold text-[var(--accent)]">
          Qualificato
        </div>
      )}
    </div>
  );
}

function TeamRow({
  seed,
  name,
  badgeUrl,
  won,
  lost,
  leg1Score,
  leg2Score,
  isTwoLeg,
  border = false,
}: {
  seed: number | null;
  name: string | null;
  badgeUrl: string | null;
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
        "flex items-center gap-2 px-3 py-2.5 transition-colors",
        border ? "border-b border-[var(--border)]" : "",
        won ? "bg-[oklch(0.96_0.02_258)]" : "",
        lost ? "opacity-45" : "",
      ].join(" ")}
    >
      {seed && (
        <span className="w-5 shrink-0 text-center text-xs font-medium text-[var(--muted)]">
          {seed}
        </span>
      )}

      <TeamMiniLogo name={name ?? "TBD"} badgeUrl={badgeUrl} />

      <span
        className={[
          "flex-1 truncate text-sm font-semibold",
          won
            ? "text-[var(--accent)]"
            : name
              ? "text-[var(--foreground)]"
              : "italic text-[var(--muted)]",
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
    return <span className="text-xs text-[var(--border-strong)]">—</span>;
  }

  if (isTwoLeg) {
    return (
      <div
        className="flex gap-1 text-sm font-semibold tabular-nums text-[var(--foreground)]"
        style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
      >
        <span>{leg1Score ?? "—"}</span>
        <span className="text-[var(--border-strong)]">|</span>
        <span>{leg2Score ?? "—"}</span>
      </div>
    );
  }

  return (
    <span
      className="text-sm font-semibold tabular-nums text-[var(--foreground)]"
      style={{ fontFamily: "var(--font-mono, ui-monospace)" }}
    >
      {leg1Score ?? "—"}
    </span>
  );
}

function TeamMiniLogo({
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
        className="h-6 w-6 shrink-0 rounded-lg object-contain"
      />
    );
  }

  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--card-2)] text-[9px] font-black text-[var(--muted)]">
      {initials || "?"}
    </span>
  );
}