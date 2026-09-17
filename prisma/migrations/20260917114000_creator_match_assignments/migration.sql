-- Creator preference for one active team in the tournament.
ALTER TABLE "CreatorProfile"
ADD COLUMN "preferredTeamId" TEXT;

-- Weekly/match coverage is modeled as a many-to-many relation so more than one
-- creator can cover the same match and the same creator can cover different
-- matches when their times do not overlap.
CREATE TABLE "CreatorMatchAssignment" (
    "id" TEXT NOT NULL,
    "creatorId" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CreatorMatchAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CreatorMatchAssignment_creatorId_matchId_key"
ON "CreatorMatchAssignment"("creatorId", "matchId");

CREATE INDEX "CreatorMatchAssignment_creatorId_idx"
ON "CreatorMatchAssignment"("creatorId");

CREATE INDEX "CreatorMatchAssignment_matchId_idx"
ON "CreatorMatchAssignment"("matchId");

CREATE INDEX "CreatorProfile_preferredTeamId_idx"
ON "CreatorProfile"("preferredTeamId");

ALTER TABLE "CreatorProfile"
ADD CONSTRAINT "CreatorProfile_preferredTeamId_fkey"
FOREIGN KEY ("preferredTeamId") REFERENCES "Team"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "CreatorMatchAssignment"
ADD CONSTRAINT "CreatorMatchAssignment_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "CreatorProfile"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CreatorMatchAssignment"
ADD CONSTRAINT "CreatorMatchAssignment_matchId_fkey"
FOREIGN KEY ("matchId") REFERENCES "Match"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
