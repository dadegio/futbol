import assert from "node:assert/strict";
import test from "node:test";
import {
  findCreatorAssignmentConflicts,
  normalizeCreatorIds,
} from "../src/modules/media/domain/creator-assignment.ts";

test("assegnazioni creator rimuovono duplicati e valori vuoti", () => {
  assert.deepEqual(normalizeCreatorIds([" c1 ", "", "c1", null, "c2"]), [
    "c1",
    "c2",
  ]);
});

test("segnala un creator assegnato a due partite sovrapposte", () => {
  const conflicts = findCreatorAssignmentConflicts([
    {
      matchId: "m1",
      startsAt: new Date("2026-09-22T18:00:00.000Z"),
      endsAt: new Date("2026-09-22T19:30:00.000Z"),
      creatorIds: ["creator-1"],
    },
    {
      matchId: "m2",
      startsAt: new Date("2026-09-22T19:00:00.000Z"),
      endsAt: new Date("2026-09-22T20:30:00.000Z"),
      creatorIds: ["creator-1", "creator-2"],
    },
  ]);

  assert.deepEqual(conflicts, [
    {
      creatorId: "creator-1",
      firstMatchId: "m1",
      secondMatchId: "m2",
    },
  ]);
});

test("consente allo stesso creator partite non sovrapposte o ancora senza orario", () => {
  const conflicts = findCreatorAssignmentConflicts([
    {
      matchId: "m1",
      startsAt: new Date("2026-09-22T18:00:00.000Z"),
      endsAt: new Date("2026-09-22T19:00:00.000Z"),
      creatorIds: ["creator-1"],
    },
    {
      matchId: "m2",
      startsAt: new Date("2026-09-22T19:00:00.000Z"),
      endsAt: new Date("2026-09-22T20:00:00.000Z"),
      creatorIds: ["creator-1"],
    },
    {
      matchId: "m3",
      startsAt: null,
      endsAt: null,
      creatorIds: ["creator-1"],
    },
  ]);

  assert.deepEqual(conflicts, []);
});
