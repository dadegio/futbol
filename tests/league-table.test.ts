import assert from "node:assert/strict";
import test from "node:test";
import { calculateLeagueTable } from "../src/modules/stats/domain/league-table.ts";

const teams = [
  { id: "a", name: "Alpha", badgeUrl: null },
  { id: "b", name: "Beta", badgeUrl: null },
  { id: "c", name: "Gamma", badgeUrl: null },
];

test("classifica calcola vittorie, pareggi, gol e punti", () => {
  const table = calculateLeagueTable(teams, [
    { homeTeamId: "a", awayTeamId: "b", homeGoals: 2, awayGoals: 1 },
    { homeTeamId: "c", awayTeamId: "a", homeGoals: 0, awayGoals: 0 },
    { homeTeamId: "b", awayTeamId: "c", homeGoals: 3, awayGoals: 3 },
  ]);

  const alpha = table.find((row) => row.teamId === "a")!;
  const beta = table.find((row) => row.teamId === "b")!;
  const gamma = table.find((row) => row.teamId === "c")!;

  assert.deepEqual(
    { played: alpha.played, wins: alpha.wins, draws: alpha.draws, losses: alpha.losses, gf: alpha.gf, ga: alpha.ga, gd: alpha.gd, points: alpha.points },
    { played: 2, wins: 1, draws: 1, losses: 0, gf: 2, ga: 1, gd: 1, points: 4 }
  );
  assert.equal(beta.points, 1);
  assert.equal(gamma.points, 2);
  assert.equal(table[0].teamId, "a");
});

test("partite incomplete o riferite a squadre fuori classifica vengono ignorate", () => {
  const table = calculateLeagueTable(teams, [
    { homeTeamId: "a", awayTeamId: "b", homeGoals: null, awayGoals: null },
    { homeTeamId: "a", awayTeamId: "missing", homeGoals: 8, awayGoals: 0 },
  ]);
  assert.equal(table.every((row) => row.played === 0 && row.points === 0), true);
});

test("spareggi ordinano per punti, differenza reti, gol fatti, gol subiti e nome", () => {
  const tiedTeams = [
    { id: "a", name: "Zulu", badgeUrl: null },
    { id: "b", name: "Beta", badgeUrl: null },
    { id: "c", name: "Alpha", badgeUrl: null },
    { id: "d", name: "Delta", badgeUrl: null },
  ];

  const table = calculateLeagueTable(tiedTeams, [
    { homeTeamId: "a", awayTeamId: "d", homeGoals: 2, awayGoals: 0 },
    { homeTeamId: "b", awayTeamId: "d", homeGoals: 3, awayGoals: 1 },
    { homeTeamId: "c", awayTeamId: "d", homeGoals: 3, awayGoals: 1 },
  ]);

  // a, b, c hanno 3 punti e +2; b/c passano davanti per GF=3 contro 2.
  // b e c sono identiche anche nei gol subiti: decide il nome.
  assert.deepEqual(table.slice(0, 3).map((row) => row.teamId), ["c", "b", "a"]);
});