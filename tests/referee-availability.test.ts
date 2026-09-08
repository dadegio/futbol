import assert from "node:assert/strict";
import test from "node:test";
import {
  effectiveMatchEnd,
  intervalsOverlap,
  refereeAllowsStart,
  refereeHasConflict,
} from "../src/modules/referees/domain/referee-availability.ts";

test("disponibilità arbitro viene interpretata nell'orario di Roma", () => {
  const startsAt = new Date("2026-09-30T18:00:00.000Z"); // mercoledì 20:00 CEST
  assert.equal(refereeAllowsStart([{ weekday: 3, hour: 20, minute: 0 }], startsAt), true);
  assert.equal(refereeAllowsStart([{ weekday: 3, hour: 21, minute: 0 }], startsAt), false);
  assert.equal(refereeAllowsStart([], startsAt), true);
});

test("intervalli adiacenti non sono considerati sovrapposti", () => {
  const a = new Date("2026-09-30T18:00:00.000Z");
  const b = new Date("2026-09-30T19:00:00.000Z");
  const c = new Date("2026-09-30T20:00:00.000Z");
  assert.equal(intervalsOverlap(a, b, b, c), false);
  assert.equal(intervalsOverlap(a, c, b, c), true);
  assert.equal(effectiveMatchEnd(a).toISOString(), b.toISOString());
});

test("conflitto se arbitro è già occupato o se la sua squadra gioca nello stesso intervallo", () => {
  const startsAt = new Date("2026-09-30T18:00:00.000Z");
  const endsAt = new Date("2026-09-30T19:00:00.000Z");

  assert.equal(
    refereeHasConflict({
      refereeId: "ref-1",
      teamId: null,
      startsAt,
      endsAt,
      otherMatches: [
        {
          date: startsAt,
          slotEnd: endsAt,
          homeTeamId: "a",
          awayTeamId: "b",
          refereeId: "ref-1",
        },
      ],
    }),
    true
  );

  assert.equal(
    refereeHasConflict({
      refereeId: "ref-2",
      teamId: "team-ref",
      startsAt,
      endsAt,
      otherMatches: [
        {
          date: startsAt,
          slotEnd: endsAt,
          homeTeamId: "team-ref",
          awayTeamId: "other",
          refereeId: null,
        },
      ],
    }),
    true
  );
});