import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { after, test } from "node:test";
import { prisma } from "../../lib/prisma.ts";
import { listLeagueTeams } from "../../src/modules/teams/application/team-service.ts";

after(async () => {
  await prisma.$disconnect();
});

test("la lista pubblica squadre non espone dati amministrativi dei giocatori", async () => {
  const league = await prisma.league.create({
    data: { name: `IT-public-teams-${randomUUID()}` },
  });
  const team = await prisma.team.create({
    data: {
      leagueId: league.id,
      name: `Public Team ${randomUUID().slice(0, 8)}`,
    },
  });

  await prisma.player.create({
    data: {
      teamId: team.id,
      firstName: "Privacy",
      lastName: "Check",
      number: 10,
      fiscalCode: "RSSMRA80A01H501U",
      birthDate: new Date("2000-01-01T00:00:00.000Z"),
      documentSigned: true,
      privacyConsent: true,
      internalPhotoConsent: true,
      publicPhotoConsent: true,
      mediaConsent: true,
      healthDeclaration: true,
      statusNote: "dato amministrativo di test",
    },
  });

  const rows = await listLeagueTeams(league.id);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].id, team.id);
  assert.equal(rows[0]._count.players, 1);
  assert.equal("players" in rows[0], false);

  const serialized = JSON.stringify(rows[0]);
  for (const forbidden of [
    "fiscalCode",
    "birthDate",
    "documentSigned",
    "privacyConsent",
    "internalPhotoConsent",
    "publicPhotoConsent",
    "healthDeclaration",
    "statusNote",
  ]) {
    assert.equal(serialized.includes(forbidden), false, `${forbidden} non deve essere esposto`);
  }
});