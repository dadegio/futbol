"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import SeriesCard, { type SeriesData } from "./series-card";

type Props = {
  series: SeriesData[];
  leagueId: string;
  format: string;
  teamCount: number;
};

type Line = { x1: number; y1: number; x2: number; y2: number };

export default function BracketView({ series, leagueId, format, teamCount }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [lines, setLines] = useState<Line[]>([]);

  // Group series by bracketRound, sorted from first round to final
  const firstRound = teamCount / 2;
  const rounds: number[] = [];
  let r = firstRound;
  while (r >= 1) {
    rounds.push(r);
    r = r / 2;
  }

  const roundNames = new Map<number, string>();
  roundNames.set(1, "Finale");
  roundNames.set(2, "Semifinali");
  roundNames.set(4, "Quarti di finale");
  roundNames.set(8, "Ottavi di finale");

  const seriesByRound = new Map<number, SeriesData[]>();
  for (const round of rounds) {
    seriesByRound.set(
      round,
      series
        .filter((s) => s.bracketRound === round)
        .sort((a, b) => a.position - b.position)
    );
  }

  const computeLines = useCallback(() => {
    if (!containerRef.current) return;

    const container = containerRef.current;
    const rect = container.getBoundingClientRect();
    const newLines: Line[] = [];

    // For each series that feeds into another, draw a connector
    for (const s of series) {
      if (!s.winnerId && s.homeTeam && s.awayTeam) {
        // Not yet resolved, but has teams
      }

      // Find the DOM elements
      const sourceEl = container.querySelector(`[data-series="${s.id}"]`);
      if (!sourceEl) continue;

      // Find what this series feeds into
      const parentSeries = series.find(
        (ps) =>
          ps.bracketRound === s.bracketRound / 2 &&
          ps.position === Math.floor(s.position / 2)
      );
      if (!parentSeries) continue;

      const targetEl = container.querySelector(`[data-series="${parentSeries.id}"]`);
      if (!targetEl) continue;

      const sourceRect = sourceEl.getBoundingClientRect();
      const targetRect = targetEl.getBoundingClientRect();

      newLines.push({
        x1: sourceRect.right - rect.left,
        y1: sourceRect.top + sourceRect.height / 2 - rect.top,
        x2: targetRect.left - rect.left,
        y2: targetRect.top + targetRect.height / 2 - rect.top,
      });
    }

    setLines(newLines);
  }, [series]);

  useEffect(() => {
    // Compute lines after render
    const timer = setTimeout(computeLines, 100);
    window.addEventListener("resize", computeLines);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("resize", computeLines);
    };
  }, [computeLines]);

  return (
    <div
      ref={containerRef}
      className="relative overflow-x-auto"
    >
      <div
        className="flex items-stretch gap-8 py-4"
        style={{ minWidth: rounds.length * 260 }}
      >
        {rounds.map((round) => {
          const roundSeries = seriesByRound.get(round) ?? [];
          return (
            <div key={round} className="flex w-[220px] shrink-0 flex-col">
              <div className="mb-4 text-center text-xs font-semibold uppercase tracking-[0.15em] text-[var(--accent)]">
                {roundNames.get(round) ?? `Round ${round}`}
              </div>
              <div className="flex flex-1 flex-col justify-around gap-4">
                {roundSeries.map((s) => (
                  <div key={s.id} data-series={s.id}>
                    <SeriesCard
                      series={s}
                      leagueId={leagueId}
                      format={format}
                    />
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* SVG connector lines */}
      <svg
        className="pointer-events-none absolute inset-0"
        style={{ width: "100%", height: "100%" }}
      >
        {lines.map((line, i) => {
          const midX = (line.x1 + line.x2) / 2;
          return (
            <path
              key={i}
              d={`M ${line.x1} ${line.y1} C ${midX} ${line.y1}, ${midX} ${line.y2}, ${line.x2} ${line.y2}`}
              fill="none"
              stroke="var(--accent)"
              strokeOpacity={0.25}
              strokeWidth={2}
            />
          );
        })}
      </svg>
    </div>
  );
}
