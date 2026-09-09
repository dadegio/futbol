import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../lib/prisma.ts";
import { saveMatchResult } from "../../src/modules/matches/application/save-match-result.ts";
import {
  advancePlayoffSeries,
  createPlayoffs,
  savePlayoffSeriesPenalties,
} from "../../src/modules/playoffs/application/playoff-service.ts";
import { getLeagueTable } from "../../src/modules/stats/application/league-table-service.ts";

type TeamFixture = {
  id: string;
  playerIds: string[];
};

async function createLeague(name: string) {
  return prisma.league.create({ data: { name: `IT-${name}-${randomUUID()}` } });
}

async function createTeamWithPlayers(leagueId: string, name: string): Promise<TeamFixture> {
  const team = await prisma.team.create({
    data: { leagueId, name: `${name}-${randomUUID().slice(0, 8)}` },
  });
  await prisma.player.createMany({
    data: Array.from({ length: 8 }, (_, index) => ({
      teamId: team.id,
      firstName: `${name}${index + 1}`,
      lastName: "Playoff",
      number: index + 1,
      status: "AUTHORIZED",
      documentSigned: true,
      mediaConsent: true,
    })),
  });
  const players = await prisma.player.findMany({
    where: { teamId: team.id },
    orderBy: { number: "asc" },
    select: { id: true },
  });
  return { id: team.id, playerIds: players.map((player) => player.id) };
}

async function saveSimpleResult(
  match: { id: string; homeTeamId: string; awayTeamId: string },
  teams: Map<string, TeamFixture>,
  homeGoals: number,
  awayGoals: number
) {
  const home = teams.get(match.homeTeamId)!;
  const away = teams.get(match.awayTeamId)!;
  return saveMatchResult({
    matchId: match.id,
    input: {
      homeGoals,
      awayGoals,
      sheetPlayerIds: [...home.playerIds, ...away.playerIds],
      playerStats: [
        ...(homeGoals > 0 ? [{ playerId: home.playerIds[0], goals: homeGoals, assists: 0 }] : []),
        ...(awayGoals > 0 ? [{ playerId: away.playerIds[0], goals: awayGoals, assists: 0 }] : []),
      ],
    },
  });
}

after(async () => {
  await prisma.$disconnect();
});

test("SINGLE_ELIM propaga i vincitori, crea la finale e assegna il campione", async () => {
  const league = await createLeague("single-elim");
  const fixtures = await Promise.all(
    ["A", "B", "C", "D"].map((name) => createTeamWithPlayers(league.id, name))
  );
  const teams = new Map(fixtures.map((team) => [team.id, team]));

  await createPlayoffs(league.id, {
    format: "SINGLE_ELIM",
    teamCount: 4,
    autoSeed: false,
    manualTeamIds: fixtures.map((team) => team.id),
  });

  const semifinals = await prisma.match.findMany({
    where: { leagueId: league.id, series: { bracketRound: 2 } },
    orderBy: { id: "asc" },
    select: { id: true, homeTeamId: true, awayTeamId: true },
  });
  assert.equal(semifinals.length, 2);

  for (const semifinal of semifinals) {
    await saveSimpleResult(semifinal, teams, 2, 0);
  }

  const finalSeries = await prisma.playoffSeries.findFirstOrThrow({
    where: { leagueId: league.id, bracketRound: 1 },
    include: { matches: true },
  });
  assert.ok(finalSeries.homeTeamId);
  assert.ok(finalSeries.awayTeamId);
  assert.equal(finalSeries.matches.length, 1);

  const finalMatch = finalSeries.matches[0];
  await saveSimpleResult(finalMatch, teams, 1, 0);

  const completedFinal = await prisma.playoffSeries.findUniqueOrThrow({
    where: { id: finalSeries.id },
  });
  assert.equal(completedFinal.winnerId, finalMatch.homeTeamId);

  const regularSeasonTable = await getLeagueTable(league.id);
  assert.equal(
    regularSeasonTable.every((row) => row.played === 0 && row.points === 0),
    true,
    "le gare playoff non devono alterare la classifica del girone"
  );
});

test("TWO_LEG in parità aggregata resta aperto finché i rigori non determinano il vincitore", async () => {
  const league = await createLeague("two-leg");
  const fixtures = await Promise.all(
    ["HomeSeed", "AwaySeed"].map((name) => createTeamWithPlayers(league.id, name))
  );
  const teams = new Map(fixtures.map((team) => [team.id, team]));

  await createPlayoffs(league.id, {
    format: "TWO_LEG",
    teamCount: 2,
    autoSeed: false,
    manualTeamIds: fixtures.map((team) => team.id),
  });

  const series = await prisma.playoffSeries.findFirstOrThrow({
    where: { leagueId: league.id, bracketRound: 1 },
    include: { matches: { orderBy: { leg: "asc" } } },
  });
  assert.equal(series.matches.length, 2);

  await saveSimpleResult(series.matches[0], teams, 1, 0);
  await saveSimpleResult(series.matches[1], teams, 1, 0);

  const tied = await prisma.playoffSeries.findUniqueOrThrow({ where: { id: series.id } });
  assert.equal(tied.winnerId, null);

  await savePlayoffSeriesPenalties(league.id, series.id, {
    penaltiesHome: 5,
    penaltiesAway: 4,
  });
  const advanced = await advancePlayoffSeries(league.id, { seriesId: series.id });

  assert.equal(advanced.winnerId, series.homeTeamId);
  const completed = await prisma.playoffSeries.findUniqueOrThrow({ where: { id: series.id } });
  assert.equal(completed.winnerId, series.homeTeamId);
});
