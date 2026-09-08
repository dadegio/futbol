import assert from "node:assert/strict";
import test from "node:test";
import {
  createToken,
  hashPassword,
  parseToken,
  verifyPassword,
  type SessionUser,
} from "../lib/session.ts";

process.env.AUTH_SECRET = "test-secret-not-for-production";

test("password hash verifica la password corretta e rifiuta quella errata", () => {
  const hash = hashPassword("Password-123!");
  assert.equal(verifyPassword("Password-123!", hash), true);
  assert.equal(verifyPassword("wrong", hash), false);
  assert.equal(verifyPassword("Password-123!", "broken-value"), false);
});

test("token sessione preserva identità e ruoli e rifiuta manomissioni", () => {
  const session: SessionUser = {
    userId: "u1",
    username: "capitano",
    role: "CAPTAIN",
    teamId: "team-1",
    refereeId: null,
    leagueId: "league-1",
  };
  const token = createToken(session);
  assert.deepEqual(parseToken(token), session);

  const tampered = `${token.slice(0, -1)}${token.endsWith("a") ? "b" : "a"}`;
  assert.equal(parseToken(tampered), null);
});