export type FormResult = "W" | "D" | "L";

export type LeagueOverview = {
  completedMatches: number;
  totalGoals: number;
  averageGoalsPerMatch: number;
  totalCleanSheets: number;
  draws: number;
  homeWins: number;
  awayWins: number;
  teams: number;
  players: number;
};

export type TeamStat = {
  teamId: string;
  teamName: string;
  badgeUrl: string | null;
  colorHex: string | null;
  secondaryColorHex: string | null;
  played: number;
  wins: number;
  draws: number;
  losses: number;
  gf: number;
  ga: number;
  gd: number;
  points: number;
  pointsPerGame: number;
  goalsPerGame: number;
  goalsAgainstPerGame: number;
  cleanSheets: number;
  form: FormResult[];
  winStreak: number;
  unbeatenStreak: number;
};

export type PlayerStat = {
  playerId: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string | null;
  photoUrl: string | null;
  photoZoom: number;
  photoPositionX: number;
  photoPositionY: number;
  isTeamCaptain: boolean;
  teamId: string;
  teamName: string;
  teamBadgeUrl: string | null;
  appearances: number;
  goals: number;
  assists: number;
  contributions: number;
  goalsPerAppearance: number;
  assistsPerAppearance: number;
  contributionsPerAppearance: number;
};

export type MatchRecord = {
  matchId: string;
  date: string | null;
  homeTeamName: string;
  awayTeamName: string;
  homeGoals: number;
  awayGoals: number;
};

export type LeagueStatsResponse = {
  overview: LeagueOverview;
  teamStats: TeamStat[];
  playerStats: PlayerStat[];
  leaders: {
    topScorer: PlayerStat | null;
    topAssister: PlayerStat | null;
    topContributor: PlayerStat | null;
    mostAppearances: PlayerStat | null;
  };
  records: {
    bestAttack: TeamStat | null;
    bestDefense: TeamStat | null;
    mostCleanSheets: TeamStat | null;
    biggestWin: (MatchRecord & { margin: number }) | null;
    highestScoringMatch: (MatchRecord & { totalGoals: number }) | null;
    bestSingleMatch:
      | (MatchRecord & {
          playerId: string;
          playerName: string;
          teamName: string;
          goals: number;
          assists: number;
        })
      | null;
    longestWinningStreak:
      | {
          teamId: string;
          teamName: string;
          badgeUrl: string | null;
          longestWinningStreak: number;
          longestUnbeatenStreak: number;
        }
      | null;
    longestUnbeatenStreak:
      | {
          teamId: string;
          teamName: string;
          badgeUrl: string | null;
          longestWinningStreak: number;
          longestUnbeatenStreak: number;
        }
      | null;
  };
};