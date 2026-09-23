-- Multi-tournament captain assignments. Keep User.teamId as a backwards-compatible primary team.
CREATE TABLE "CaptainAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptainAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CaptainAssignment_teamId_key" ON "CaptainAssignment"("teamId");
CREATE UNIQUE INDEX "CaptainAssignment_userId_leagueId_key" ON "CaptainAssignment"("userId", "leagueId");
CREATE INDEX "CaptainAssignment_userId_idx" ON "CaptainAssignment"("userId");
CREATE INDEX "CaptainAssignment_leagueId_idx" ON "CaptainAssignment"("leagueId");

ALTER TABLE "CaptainAssignment"
  ADD CONSTRAINT "CaptainAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CaptainAssignment_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "CaptainAssignment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "CaptainAssignment" ("id", "userId", "leagueId", "teamId", "createdAt")
SELECT
  'legacy_' || u."id",
  u."id",
  t."leagueId",
  u."teamId",
  CURRENT_TIMESTAMP
FROM "User" u
JOIN "Team" t ON t."id" = u."teamId"
WHERE u."role" = 'CAPTAIN' AND u."teamId" IS NOT NULL
ON CONFLICT DO NOTHING;
