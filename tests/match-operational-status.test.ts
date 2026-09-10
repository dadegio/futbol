import assert from "node:assert/strict";
import test from "node:test";
import { deriveMatchOperationalState } from "../src/modules/matches/domain/match-operational-status.ts";

const now = new Date("2026-10-07T16:00:00.000Z");
const future = new Date("2026-10-07T19:00:00.000Z");

test("partita senza slot viene segnalata da organizzare", () => {
  const state = deriveMatchOperationalState({ date: null, now });
  assert.equal(state.status, "NEEDS_SETUP");
  assert.deepEqual(state.issues.map((item) => item.code), ["NO_SLOT"]);
});

test("partita con campo, arbitro e distinte complete è pronta", () => {
  const state = deriveMatchOperationalState({
    date: future,
    venueKey: "field-1",
    refereeId: "ref-1",
    homeSheetCount: 8,
    awaySheetCount: 8,
    now,
  });
  assert.equal(state.status, "READY");
  assert.equal(state.ready, true);
  assert.equal(state.issues.length, 0);
});

test("vicino al calcio d'inizio segnala le distinte incomplete", () => {
  const state = deriveMatchOperationalState({
    date: future,
    venueKey: "field-1",
    refereeId: "ref-1",
    homeSheetCount: 7,
    awaySheetCount: 8,
    now,
    sheetAttentionHours: 6,
  });
  assert.equal(state.status, "BOOKED");
  assert.equal(state.issues.some((item) => item.code === "HOME_SHEET_INCOMPLETE"), true);
});

test("partita passata senza risultato ha priorità operativa", () => {
  const state = deriveMatchOperationalState({
    date: new Date("2026-10-06T19:00:00.000Z"),
    venueKey: "field-1",
    refereeId: "ref-1",
    homeSheetCount: 8,
    awaySheetCount: 8,
    now,
  });
  assert.equal(state.status, "AWAITING_RESULT");
  assert.equal(state.issues.some((item) => item.code === "RESULT_OVERDUE"), true);
});


test("bozza risultato resta fuori dallo stato completato", () => {
  const state = deriveMatchOperationalState({
    date: new Date("2026-10-07T15:00:00.000Z"),
    venueKey: "field-1",
    refereeId: "ref-1",
    homeGoals: 2,
    awayGoals: 1,
    resultStatus: "DRAFT",
    homeSheetCount: 8,
    awaySheetCount: 8,
    now,
  });
  assert.equal(state.status, "DRAFT_RESULT");
  assert.equal(state.completed, false);
});

test("rinviata e annullata hanno stati operativi espliciti", () => {
  const postponed = deriveMatchOperationalState({ date: null, lifecycleStatus: "POSTPONED", now });
  const cancelled = deriveMatchOperationalState({ date: null, lifecycleStatus: "CANCELLED", now });
  assert.equal(postponed.status, "POSTPONED");
  assert.equal(postponed.issues[0]?.code, "POSTPONED");
  assert.equal(cancelled.status, "CANCELLED");
  assert.equal(cancelled.issues.length, 0);
});
