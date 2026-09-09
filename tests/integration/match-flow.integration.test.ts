import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../lib/prisma.ts";
import { saveMatchResult } from "../../src/modules/matches/application/save-match-result.ts";
import { resetMatchResult } from "../../src/modules/matches/application/reset-match-result.ts";
import { getLeagueTable } from "../../src/modules/stats/application/league-table-service.ts";
import { getLeagueStats } from "../../src/modules/stats/application/league-stats-service.ts";

type TeamFixture = {
  id: string;
  playerIds: string[];
};

async function createLeague(name: string) {
  return prisma.league.create({ data: { name: `IT-${name}-${randomUUID()}` } });
}

async function createTeamWithEligiblePlayers(
  leagueId: string,
  name: string,
  playerCount = 8
): Promise<TeamFixture> {
  const team = await prisma.team.create({
    data: { leagueId, name: `${name}-${randomUUID().slice(0, 8)}` },
  });

  await prisma.player.createMany({
    data: Array.from({ length: playerCount }, (_, index) => ({
      teamId: team.id,
      firstName: `${name}${index + 1}`,
      lastName: "Integration",
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

after(async () => {
  await prisma.$disconnect();
});

test("distinta -> risultato -> statistiche -> classifica restano coerenti", async () => {
  const league = await createLeague("match-flow");
  const home = await createTeamWithEligiblePlayers(league.id, "Home");
  const away = await createTeamWithEligiblePlayers(league.id, "Away");
  const match = await prisma.match.create({
    data: {
      leagueId: league.id,
      round: 1,
      homeTeamId: home.id,
      awayTeamId: away.id,
    },
  });

  await saveMatchResult({
    matchId: match.id,
    input: {
      homeGoals: 3,
      awayGoals: 1,
      sheetPlayerIds: [...home.playerIds, ...away.playerIds],
      playerStats: [
        { playerId: home.playerIds[0], goals: 2, assists: 0 },
        { playerId: home.playerIds[1], goals: 1, assists: 1 },
        { playerId: away.playerIds[0], goals: 1, assists: 0 },
      ],
    },
  });

  const stored = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
  assert.equal(stored.homeGoals, 3);
  assert.equal(stored.awayGoals, 1);
  assert.equal(await prisma.matchSheetPlayer.count({ where: { matchId: match.id } }), 16);
  assert.equal(await prisma.matchPlayerStat.count({ where: { matchId: match.id } }), 3);

  const table = await getLeagueTable(league.id);
  assert.deepEqual(
    table.map((row) => [row.teamId, row.played, row.points]),
    [
      [home.id, 1, 3],
      [away.id, 1, 0],
    ]
  );

  const stats = await getLeagueStats(league.id);
  assert.equal(stats.overview.completedMatches, 1);
  assert.equal(stats.overview.totalGoals, 4);
  assert.equal(stats.leaders.topScorer?.playerId, home.playerIds[0]);
  assert.equal(
    stats.playerStats.find((player) => player.playerId === home.playerIds[0])?.appearances,
    1
  );
});

test("un errore dentro la transazione non lascia risultato, distinta o statistiche a metà", async () => {
  const league = await createLeague("rollback");
  const home = await createTeamWithEligiblePlayers(league.id, "RollbackHome");
  const away = await createTeamWithEligiblePlayers(league.id, "RollbackAway");
  const match = await prisma.match.create({
    data: {
      leagueId: league.id,
      round: 1,
      homeTeamId: home.id,
      awayTeamId: away.id,
    },
  });

  const sheet = [...home.playerIds, ...away.playerIds];
  await saveMatchResult({
    matchId: match.id,
    input: {
      homeGoals: 1,
      awayGoals: 0,
      sheetPlayerIds: sheet,
      playerStats: [{ playerId: home.playerIds[0], goals: 1, assists: 0 }],
    },
  });

  await assert.rejects(() =>
    saveMatchResult({
      matchId: match.id,
      input: {
        homeGoals: 9,
        awayGoals: 9,
        sheetPlayerIds: sheet,
        playerStats: [
          { playerId: home.playerIds[0], goals: 4, assists: 0 },
          { playerId: home.playerIds[0], goals: 5, assists: 0 },
          { playerId: away.playerIds[0], goals: 9, assists: 0 },
        ],
      },
    })
  );

  const stored = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
  const storedStats = await prisma.matchPlayerStat.findMany({ where: { matchId: match.id } });
  assert.equal(stored.homeGoals, 1);
  assert.equal(stored.awayGoals, 0);
  assert.equal(await prisma.matchSheetPlayer.count({ where: { matchId: match.id } }), 16);
  assert.equal(storedStats.length, 1);
  assert.equal(storedStats[0].playerId, home.playerIds[0]);
  assert.equal(storedStats[0].goals, 1);
});

test("il totale marcatori deve coincidere con il risultato prima di scrivere sul DB", async () => {
  const league = await createLeague("scorer-total");
  const home = await createTeamWithEligiblePlayers(league.id, "ScorerHome");
  const away = await createTeamWithEligiblePlayers(league.id, "ScorerAway");
  const match = await prisma.match.create({
    data: {
      leagueId: league.id,
      round: 1,
      homeTeamId: home.id,
      awayTeamId: away.id,
    },
  });

  await assert.rejects(
    () =>
      saveMatchResult({
        matchId: match.id,
        input: {
          homeGoals: 2,
          awayGoals: 0,
          sheetPlayerIds: [...home.playerIds, ...away.playerIds],
          playerStats: [{ playerId: home.playerIds[0], goals: 1, assists: 0 }],
        },
      }),
    (error: unknown) => {
      if (typeof error !== "object" || error === null) return false;
      const appError = error as { status?: unknown; code?: unknown };
      return appError.status === 400 && appError.code === "HOME_SCORER_TOTAL_MISMATCH";
    }
  );

  const stored = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
  assert.equal(stored.homeGoals, null);
  assert.equal(stored.awayGoals, null);
  assert.equal(await prisma.matchSheetPlayer.count({ where: { matchId: match.id } }), 0);
  assert.equal(await prisma.matchPlayerStat.count({ where: { matchId: match.id } }), 0);
});


test("reset partita elimina distinta e risultato ma conserva prenotazione e arbitro", async () => {
  const league = await createLeague("reset-match");
  const home = await createTeamWithEligiblePlayers(league.id, "ResetHome");
  const away = await createTeamWithEligiblePlayers(league.id, "ResetAway");
  const referee = await prisma.referee.create({
    data: { leagueId: league.id, name: `Referee-${randomUUID()}` },
  });
  const date = new Date("2026-10-14T18:00:00.000Z");
  const match = await prisma.match.create({
    data: {
      leagueId: league.id,
      round: 2,
      homeTeamId: home.id,
      awayTeamId: away.id,
      date,
      slotEnd: new Date("2026-10-14T19:00:00.000Z"),
      venueKey: "field-reset",
      venueName: "Campo Test",
      venueAddress: "Via Test 1",
      refereeId: referee.id,
    },
  });

  await saveMatchResult({
    matchId: match.id,
    input: {
      homeGoals: 1,
      awayGoals: 0,
      sheetPlayerIds: [...home.playerIds, ...away.playerIds],
      playerStats: [{ playerId: home.playerIds[0], goals: 1, assists: 0 }],
    },
  });

  const result = await resetMatchResult(match.id);
  assert.equal(result.hadRecordedData, true);
  assert.equal(result.clearedSheetPlayers, 16);
  assert.equal(result.clearedStats, 1);

  const stored = await prisma.match.findUniqueOrThrow({ where: { id: match.id } });
  assert.equal(stored.homeGoals, null);
  assert.equal(stored.awayGoals, null);
  assert.equal(stored.date?.toISOString(), date.toISOString());
  assert.equal(stored.venueKey, "field-reset");
  assert.equal(stored.venueName, "Campo Test");
  assert.equal(stored.refereeId, referee.id);
  assert.equal(await prisma.matchSheetPlayer.count({ where: { matchId: match.id } }), 0);
  assert.equal(await prisma.matchPlayerStat.count({ where: { matchId: match.id } }), 0);

  const table = await getLeagueTable(league.id);
  assert.equal(table.find((row) => row.teamId === home.id)?.played, 0);
  assert.equal(table.find((row) => row.teamId === away.id)?.played, 0);
});
