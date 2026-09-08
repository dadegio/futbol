export type LeagueTableTeam = {
  id: string;
  name: string;
  badgeUrl: string | null;
};

export type LeagueTableMatch = {
  homeTeamId: string;
  awayTeamId: string;
  homeGoals: number | null;
  awayGoals: number | null;
};

export type LeagueTableRow = {
  teamId: string;
  teamName: string;
  badgeUrl: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
};

export function calculateLeagueTable(
  teams: LeagueTableTeam[],
  matches: LeagueTableMatch[]
): LeagueTableRow[] {
  const tableByTeam = new Map<string, LeagueTableRow>();

  for (const team of teams) {
    tableByTeam.set(team.id, {
      teamId: team.id,
      teamName: team.name,
      badgeUrl: team.badgeUrl,
      played: 0,
      wins: 0,
      draws: 0,
      losses: 0,
      gf: 0,
      ga: 0,
      gd: 0,
      points: 0,
    });
  }

  for (const match of matches) {
    if (match.homeGoals === null || match.awayGoals === null) continue;

    const home = tableByTeam.get(match.homeTeamId);
    const away = tableByTeam.get(match.awayTeamId);
    if (!home || !away) continue;

    const homeGoals = match.homeGoals;
    const awayGoals = match.awayGoals;

    home.played += 1;
    away.played += 1;
    home.gf += homeGoals;
    home.ga += awayGoals;
    away.gf += awayGoals;
    away.ga += homeGoals;

    if (homeGoals > awayGoals) {
      home.wins += 1;
      away.losses += 1;
      home.points += 3;
    } else if (homeGoals < awayGoals) {
      away.wins += 1;
      home.losses += 1;
      away.points += 3;
    } else {
      home.draws += 1;
      away.draws += 1;
      home.points += 1;
      away.points += 1;
    }
  }

  for (const row of tableByTeam.values()) {
    row.gd = row.gf - row.ga;
  }

  return Array.from(tableByTeam.values()).sort((left, right) => {
    if (right.points !== left.points) return right.points - left.points;
    if (right.gd !== left.gd) return right.gd - left.gd;
    if (right.gf !== left.gf) return right.gf - left.gf;
    if (left.ga !== right.ga) return left.ga - right.ga;
    return left.teamName.localeCompare(right.teamName);
  });
}