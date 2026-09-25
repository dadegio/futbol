import assert from "node:assert/strict";
import test from "node:test";
import {
  assignPlayersToFormation,
  coachRolePreferences,
} from "../src/modules/coaches/domain/coach-formations.ts";

test("riconosce i ruoli principali del torneo", () => {
  assert.deepEqual(coachRolePreferences("POR"), ["GK"]);
  assert.equal(coachRolePreferences("DC")[0], "DEF");
  assert.equal(coachRolePreferences("CC")[0], "MID");
  assert.equal(coachRolePreferences("ES")[0], "MID");
  assert.equal(coachRolePreferences("ATT")[0], "ATT");
});

test("un attaccante viene assegnato a uno slot ATT anche se aggiunto dopo i centrocampisti", () => {
  const assigned = assignPlayersToFormation(
    [
      { playerId: "gk", position: "POR" },
      { playerId: "d1", position: "DC" },
      { playerId: "d2", position: "DC" },
      { playerId: "m1", position: "CC" },
      { playerId: "m2", position: "CC" },
      { playerId: "m3", position: "ES" },
      { playerId: "a1", position: "ATT" },
    ],
    "2-3-2"
  );

  assert.ok(assigned);
  assert.equal(assigned?.a1.role, "ATT");
  assert.equal(assigned?.gk.role, "GK");
});

test("rifiuta un modulo quando non esistono abbastanza slot compatibili", () => {
  const assigned = assignPlayersToFormation(
    [
      { playerId: "gk", position: "POR" },
      { playerId: "a1", position: "ATT" },
      { playerId: "a2", position: "ATT" },
      { playerId: "a3", position: "ATT" },
      { playerId: "a4", position: "ATT" },
    ],
    "4-2-1"
  );

  assert.equal(assigned, null);
});
