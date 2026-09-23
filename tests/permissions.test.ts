import assert from "node:assert/strict";
import test from "node:test";
import { canPerform } from "../src/modules/permissions/permissions.ts";
import type { SessionUser } from "../lib/session.ts";

function user(overrides: Partial<SessionUser>): SessionUser {
  return {
    userId: "user-1",
    username: "tester",
    role: "CAPTAIN",
    teamId: null,
    refereeId: null,
    leagueId: null,
    captainAssignments: [],
    ...overrides,
  };
}

test("super admin può eseguire ogni permission indipendentemente dal contesto", () => {
  const admin = user({ role: "ADMIN" });
  assert.equal(canPerform(admin, "platform:manage", { leagueId: "other" }), true);
  assert.equal(canPerform(admin, "match:edit", { assignedRefereeId: "ref-x" }), true);
});

test("league admin è limitato al proprio torneo", () => {
  const admin = user({ role: "LEAGUE_ADMIN", leagueId: "league-1" });
  assert.equal(canPerform(admin, "team:manage", { leagueId: "league-1" }), true);
  assert.equal(canPerform(admin, "booking:override", { leagueId: "league-1" }), true);
  assert.equal(canPerform(admin, "team:manage", { leagueId: "league-2" }), false);
  assert.equal(canPerform(admin, "platform:manage", { leagueId: "league-1" }), false);
});

test("capitano può gestire e prenotare solo per la propria squadra", () => {
  const captain = user({ role: "CAPTAIN", leagueId: "league-1", teamId: "team-a" });

  assert.equal(
    canPerform(captain, "booking:create", {
      leagueId: "league-1",
      matchTeamIds: ["team-a", "team-b"],
    }),
    true
  );
  assert.equal(canPerform(captain, "team:manage", { teamId: "team-a" }), true);
  assert.equal(canPerform(captain, "player:manage", { teamId: "team-b" }), false);
  assert.equal(
    canPerform(captain, "booking:create", {
      leagueId: "league-1",
      matchTeamIds: ["team-b", "team-c"],
    }),
    false
  );
  assert.equal(
    canPerform(captain, "match:edit", {
      leagueId: "league-1",
      matchTeamIds: ["team-a", "team-b"],
    }),
    false,
    "la permission di booking non deve concedere modifica risultato"
  );
});

test("capitano può appartenere a squadre di tornei diversi", () => {
  const captain = user({
    role: "CAPTAIN",
    teamId: "team-a",
    leagueId: "league-1",
    captainAssignments: [
      { leagueId: "league-1", teamId: "team-a" },
      { leagueId: "league-2", teamId: "team-b" },
    ],
  });

  assert.equal(canPerform(captain, "league:view", { leagueId: "league-2" }), true);
  assert.equal(canPerform(captain, "team:manage", { leagueId: "league-2", teamId: "team-b" }), true);
  assert.equal(canPerform(captain, "player:manage", { leagueId: "league-2", teamId: "team-b" }), true);
  assert.equal(canPerform(captain, "team:manage", { leagueId: "league-2", teamId: "team-c" }), false);
});

test("arbitro può modificare solo la partita assegnata", () => {
  const referee = user({
    role: "REFEREE",
    leagueId: "league-1",
    refereeId: "ref-1",
  });

  assert.equal(
    canPerform(referee, "match:edit", {
      leagueId: "league-1",
      assignedRefereeId: "ref-1",
    }),
    true
  );
  assert.equal(
    canPerform(referee, "match:edit", {
      leagueId: "league-1",
      assignedRefereeId: "ref-2",
    }),
    false
  );
  assert.equal(canPerform(referee, "booking:create", { leagueId: "league-1" }), false);
});

test("creator può creare media nel proprio torneo ma non approvarli", () => {
  const creator = user({ role: "CREATOR", leagueId: "league-1" });
  assert.equal(canPerform(creator, "media:create", { leagueId: "league-1" }), true);
  assert.equal(canPerform(creator, "media:create", { leagueId: "league-2" }), false);
  assert.equal(canPerform(creator, "media:approve", { leagueId: "league-1" }), false);
});