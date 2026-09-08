import assert from "node:assert/strict";
import test from "node:test";
import {
  FUTPOLI_RULES,
  centsToEuro,
  getPlayerAdminMissingItems,
  getPlayerRegistrationStatus,
  isPlayerEligibleForMatchSheet,
} from "../src/modules/players/domain/tournament-rules.ts";

test("regole economiche e di rosa restano quelle del torneo", () => {
  assert.deepEqual(FUTPOLI_RULES, {
    maxPlayersPerTeam: 14,
    minPlayersInMatchSheet: 8,
    playerFeeCentsPerAppearance: 50,
    refereeCostCentsPerMatch: 2000,
    refereeCostCentsPerTeam: 1000,
  });
  assert.equal(centsToEuro(FUTPOLI_RULES.refereeCostCentsPerMatch), 20);
});

test("giocatore in distinta richiede autorizzazione, modulo e liberatoria media", () => {
  const eligible = {
    status: "AUTHORIZED",
    documentSigned: true,
    mediaConsent: true,
  };
  assert.equal(isPlayerEligibleForMatchSheet(eligible), true);
  assert.equal(isPlayerEligibleForMatchSheet({ ...eligible, status: "IN_REVIEW" }), false);
  assert.equal(isPlayerEligibleForMatchSheet({ ...eligible, documentSigned: false }), false);
  assert.equal(isPlayerEligibleForMatchSheet({ ...eligible, mediaConsent: false }), false);
});

test("stato amministrativo e motivi mancanti sono coerenti", () => {
  assert.equal(
    getPlayerRegistrationStatus({ status: "AUTHORIZED", documentSigned: true, mediaConsent: true }),
    "Iscrizione OK"
  );
  assert.equal(getPlayerRegistrationStatus({ status: "SUSPENDED" }), "Squalificato");
  assert.deepEqual(
    getPlayerAdminMissingItems({ status: "IN_REVIEW", documentSigned: false, mediaConsent: false }),
    ["stato non autorizzato", "modulo firmato", "liberatoria video/foto"]
  );
});