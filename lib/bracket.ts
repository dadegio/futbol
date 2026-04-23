export type BracketSeries = {
  bracketRound: number; // power of 2: 4=QF, 2=SF, 1=Final
  position: number; // 0-indexed within round
  homeSeed: number | null;
  awaySeed: number | null;
  feedsIntoPosition: number | null; // position in next round (bracketRound / 2)
};

/**
 * Generates a bracket structure with standard tournament seeding.
 * Seeds are placed so top seeds meet only in later rounds
 * (e.g. 1v8, 4v5, 2v7, 3v6 for 8 teams).
 */
export function generateBracket(teamCount: number): BracketSeries[] {
  if (teamCount < 2 || (teamCount & (teamCount - 1)) !== 0) {
    throw new Error("teamCount deve essere una potenza di 2 (2, 4, 8, 16)");
  }

  const series: BracketSeries[] = [];
  const firstRound = teamCount / 2; // number of first-round matchups

  // Generate seeding order for first round using standard bracket placement
  const seedOrder = buildSeedOrder(teamCount);

  // First round: actual matchups with seeds
  for (let i = 0; i < firstRound; i++) {
    series.push({
      bracketRound: firstRound,
      position: i,
      homeSeed: seedOrder[i * 2],
      awaySeed: seedOrder[i * 2 + 1],
      feedsIntoPosition: Math.floor(i / 2),
    });
  }

  // Subsequent rounds: empty matchups waiting for winners
  let currentRound = firstRound / 2;
  while (currentRound >= 1) {
    for (let i = 0; i < currentRound; i++) {
      series.push({
        bracketRound: currentRound,
        position: i,
        homeSeed: null,
        awaySeed: null,
        feedsIntoPosition: currentRound === 1 ? null : Math.floor(i / 2),
      });
    }
    currentRound = currentRound / 2;
  }

  return series;
}

/**
 * Standard tournament seed placement.
 * Ensures 1 vs N, 2 vs N-1 etc., with seeds distributed so
 * higher seeds only meet in later rounds.
 *
 * For 8 teams: [1,8, 4,5, 2,7, 3,6]
 */
function buildSeedOrder(teamCount: number): number[] {
  // Start with the final: seed 1 vs seed 2
  let rounds: number[][] = [[1, 2]];

  // Expand to fill bracket
  while (rounds.length < teamCount / 2) {
    const next: number[][] = [];
    const totalSeeds = rounds.length * 4; // seeds in next expansion
    for (const match of rounds) {
      // Each match splits into two: higher seed vs new opponent, lower seed vs new opponent
      // New opponent = totalSeeds + 1 - seed (mirror seeding)
      next.push([match[0], totalSeeds + 1 - match[0]]);
      next.push([match[1], totalSeeds + 1 - match[1]]);
    }
    rounds = next;
  }

  return rounds.flat();
}

/**
 * Determines the winner of a playoff series based on match results.
 * Returns the winning team ID, or null if the series is not yet decided.
 */
export function determineSeriesWinner(
  matches: { homeTeamId: string; awayTeamId: string; homeGoals: number | null; awayGoals: number | null; leg: number | null }[],
  format: "SINGLE_ELIM" | "TWO_LEG"
): string | null {
  if (format === "SINGLE_ELIM") {
    const match = matches.find((m) => m.leg === 1);
    if (!match || match.homeGoals === null || match.awayGoals === null) return null;
    if (match.homeGoals > match.awayGoals) return match.homeTeamId;
    if (match.awayGoals > match.homeGoals) return match.awayTeamId;
    // Draw in single elim — needs extra time/penalties (manual resolution)
    return null;
  }

  // TWO_LEG: aggregate goals
  const leg1 = matches.find((m) => m.leg === 1);
  const leg2 = matches.find((m) => m.leg === 2);
  if (!leg1 || !leg2) return null;
  if (leg1.homeGoals === null || leg1.awayGoals === null) return null;
  if (leg2.homeGoals === null || leg2.awayGoals === null) return null;

  // In two-leg: leg1 home = series home team, leg2 home = series away team (reversed)
  const homeAggregate = leg1.homeGoals + leg2.awayGoals;
  const awayAggregate = leg1.awayGoals + leg2.homeGoals;

  if (homeAggregate > awayAggregate) return leg1.homeTeamId;
  if (awayAggregate > homeAggregate) return leg1.awayTeamId;
  // Aggregate tied — manual resolution needed
  return null;
}
