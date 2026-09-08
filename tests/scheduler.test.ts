import assert from "node:assert/strict";
import test from "node:test";
import { generateRoundRobin } from "../src/modules/matches/domain/scheduler.ts";

function pairKey(a: string, b: string) {
  return [a, b].sort().join("::");
}

test("14 squadre: andata completa in 13 giornate senza duplicati", () => {
  const teams = Array.from({ length: 14 }, (_, index) => `team-${index + 1}`);
  const original = [...teams];
  const matches = generateRoundRobin(teams, { random: false, doubleRound: false });

  assert.deepEqual(teams, original, "il generatore non deve mutare l'input");
  assert.equal(matches.length, 91);
  assert.equal(Math.max(...matches.map((match) => match.round)), 13);

  const pairs = new Set(matches.map((match) => pairKey(match.homeTeamId, match.awayTeamId)));
  assert.equal(pairs.size, 91);

  for (const teamId of teams) {
    assert.equal(
      matches.filter((match) => match.homeTeamId === teamId || match.awayTeamId === teamId).length,
      13
    );
  }
});

test("andata e ritorno invertono casa/trasferta e raddoppiano le giornate", () => {
  const teams = ["a", "b", "c", "d"];
  const matches = generateRoundRobin(teams, { random: false, doubleRound: true });
  const firstLeg = matches.filter((match) => match.round <= 3);
  const secondLeg = matches.filter((match) => match.round > 3);

  assert.equal(matches.length, 12);
  assert.equal(Math.max(...matches.map((match) => match.round)), 6);

  for (const first of firstLeg) {
    assert.ok(
      secondLeg.some(
        (second) =>
          second.round === first.round + 3 &&
          second.homeTeamId === first.awayTeamId &&
          second.awayTeamId === first.homeTeamId
      )
    );
  }
});

test("numero dispari di squadre gestisce il BYE senza creare partite fittizie", () => {
  const matches = generateRoundRobin(["a", "b", "c"], {
    random: false,
    doubleRound: false,
  });

  assert.equal(matches.length, 3);
  assert.equal(Math.max(...matches.map((match) => match.round)), 3);
  assert.equal(matches.some((match) => match.homeTeamId.includes("BYE") || match.awayTeamId.includes("BYE")), false);
});

test("lo stesso seed produce lo stesso calendario randomizzato", () => {
  const teams = ["a", "b", "c", "d", "e", "f"];
  const first = generateRoundRobin(teams, { random: true, seed: 42, doubleRound: false });
  const second = generateRoundRobin(teams, { random: true, seed: 42, doubleRound: false });
  assert.deepEqual(first, second);
});