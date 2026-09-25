CREATE TABLE "CoachLineupDraft" (
    "id" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "formation" TEXT NOT NULL DEFAULT '3-3-1',
    "players" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachLineupDraft_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "CoachLineupDraft_matchId_teamId_idx" ON "CoachLineupDraft"("matchId", "teamId");
CREATE INDEX "CoachLineupDraft_teamId_idx" ON "CoachLineupDraft"("teamId");
