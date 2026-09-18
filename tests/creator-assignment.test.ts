import assert from "node:assert/strict";
import test from "node:test";
import {
  findCreatorAssignmentConflicts,
  normalizeCreatorIds,
  suggestRoundCoverage,
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

test("proposta settimanale rispetta disponibilità foto/video e VEO", () => {
  const creators = [
    { id: "leonardo", displayName: "Leonardo", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "luca", displayName: "Luca", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "matteo", displayName: "Matteo", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
    { id: "claudia", displayName: "Claudia", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "rock", displayName: "Rock", coverageRole: "VIDEO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
    { id: "andrei", displayName: "Andrei", coverageRole: "VIDEO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
  ];

  const matches = Array.from({ length: 6 }, (_, index) => ({
    id: `m${index + 1}`,
    homeTeamId: index === 0 ? "veo-team" : `h${index}`,
    awayTeamId: `a${index}`,
    startsAt: null,
    endsAt: null,
    videoRequired: index !== 0,
  }));

  const suggestion = suggestRoundCoverage({ creators, matches });

  assert.equal(suggestion.photoRequired, 6);
  assert.equal(suggestion.photoAssigned, 5);
  assert.equal(suggestion.missingPhoto, 1);
  assert.equal(suggestion.veoMatches, 1);
  assert.equal(suggestion.videoRequired, 5);
  assert.equal(suggestion.videoAssigned, 4);
  assert.equal(suggestion.missingVideo, 1);
  assert.equal(suggestion.assignments[0].videoCreatorId, null);

  const usage = new Map<string, number>();
  for (const assignment of suggestion.assignments) {
    for (const creatorId of [assignment.photoCreatorId, assignment.videoCreatorId]) {
      if (!creatorId) continue;
      usage.set(creatorId, (usage.get(creatorId) ?? 0) + 1);
    }
  }
  assert.equal(usage.get("leonardo"), 1);
  assert.equal(usage.get("luca"), 1);
  assert.equal(usage.get("matteo"), 2);
  assert.equal(usage.get("claudia"), 1);
  assert.equal(usage.get("rock"), 2);
  assert.equal(usage.get("andrei"), 2);
});

test("proposta settimanale favorisce la squadra preferita quando possibile", () => {
  const suggestion = suggestRoundCoverage({
    creators: [
      {
        id: "pref",
        displayName: "Leonardo",
        coverageRole: "PHOTO",
        weeklyAssignmentLimit: 1,
        preferredTeamId: "clockwork",
      },
      {
        id: "other",
        displayName: "Luca",
        coverageRole: "PHOTO",
        weeklyAssignmentLimit: 1,
        preferredTeamId: null,
      },
    ],
    matches: [
      {
        id: "m1",
        homeTeamId: "clockwork",
        awayTeamId: "politori",
        startsAt: null,
        endsAt: null,
        videoRequired: false,
      },
      {
        id: "m2",
        homeTeamId: "audaix",
        awayTeamId: "kronos",
        startsAt: null,
        endsAt: null,
        videoRequired: false,
      },
    ],
  });

  assert.equal(suggestion.assignments[0].photoCreatorId, "pref");
  assert.equal(suggestion.assignments[1].photoCreatorId, "other");
});

test("proposta non assegna lo stesso creator a due gare sovrapposte", () => {
  const suggestion = suggestRoundCoverage({
    creators: [
      {
        id: "matteo",
        displayName: "Matteo",
        coverageRole: "PHOTO",
        weeklyAssignmentLimit: 2,
        preferredTeamId: null,
      },
    ],
    matches: [
      {
        id: "m1",
        homeTeamId: "a",
        awayTeamId: "b",
        startsAt: new Date("2026-09-22T18:00:00.000Z"),
        endsAt: new Date("2026-09-22T19:30:00.000Z"),
        videoRequired: false,
      },
      {
        id: "m2",
        homeTeamId: "c",
        awayTeamId: "d",
        startsAt: new Date("2026-09-22T19:00:00.000Z"),
        endsAt: new Date("2026-09-22T20:30:00.000Z"),
        videoRequired: false,
      },
    ],
  });

  assert.equal(suggestion.photoAssigned, 1);
  assert.equal(suggestion.missingPhoto, 1);
});

test("due sorgenti video automatiche lasciano quattro gare a Rock e Andrei", () => {
  const creators = [
    { id: "leonardo", displayName: "Leonardo", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "luca", displayName: "Luca", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "matteo", displayName: "Matteo", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
    { id: "claudia", displayName: "Claudia", coverageRole: "PHOTO" as const, weeklyAssignmentLimit: 1, preferredTeamId: null },
    { id: "rock", displayName: "Rock", coverageRole: "VIDEO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
    { id: "andrei", displayName: "Andrei", coverageRole: "VIDEO" as const, weeklyAssignmentLimit: 2, preferredTeamId: null },
  ];
  const matches = Array.from({ length: 6 }, (_, index) => ({
    id: `dual-${index + 1}`,
    homeTeamId: `home-${index}`,
    awayTeamId: `away-${index}`,
    startsAt: null,
    endsAt: null,
    videoRequired: index >= 2,
  }));

  const suggestion = suggestRoundCoverage({ creators, matches });
  assert.equal(suggestion.photoAssigned, 5);
  assert.equal(suggestion.missingPhoto, 1);
  assert.equal(suggestion.videoRequired, 4);
  assert.equal(suggestion.videoAssigned, 4);
  assert.equal(suggestion.missingVideo, 0);
});
