import assert from "node:assert/strict";
import test from "node:test";
import {
  COACH_FORMATIONS,
  COACH_FORMATION_OPTIONS,
  lineupDeadline,
} from "../src/modules/coaches/domain/coach-formations.ts";

test("tutti i moduli automatici a 8 definiscono otto posizioni valide", () => {
  for (const formation of COACH_FORMATION_OPTIONS) {
    const points = COACH_FORMATIONS[formation];
    assert.equal(points.length, 8);
    for (const point of points) {
      assert.ok(point.x >= 0 && point.x <= 100);
      assert.ok(point.y >= 0 && point.y <= 100);
    }
  }
});

test("la formazione si blocca trenta minuti prima della partita", () => {
  const kickOff = new Date("2026-10-06T21:00:00+02:00");
  assert.equal(
    lineupDeadline(kickOff)?.toISOString(),
    "2026-10-06T18:30:00.000Z"
  );
});
