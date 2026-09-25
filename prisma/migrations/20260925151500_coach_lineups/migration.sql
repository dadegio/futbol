DO $$ BEGIN
  CREATE TYPE "LineupPlayerStatus" AS ENUM ('STARTER', 'BENCH');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE "MatchLineup" (
  "id" TEXT NOT NULL,
  "matchId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "formation" TEXT NOT NULL DEFAULT '3-3-1',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MatchLineup_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "MatchLineupPlayer" (
  "id" TEXT NOT NULL,
  "lineupId" TEXT NOT NULL,
  "playerId" TEXT NOT NULL,
  "status" "LineupPlayerStatus" NOT NULL,
  "positionX" INTEGER,
  "positionY" INTEGER,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "MatchLineupPlayer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "MatchLineup_matchId_teamId_key"
  ON "MatchLineup"("matchId", "teamId");
CREATE INDEX "MatchLineup_teamId_idx" ON "MatchLineup"("teamId");
CREATE INDEX "MatchLineup_matchId_idx" ON "MatchLineup"("matchId");

CREATE UNIQUE INDEX "MatchLineupPlayer_lineupId_playerId_key"
  ON "MatchLineupPlayer"("lineupId", "playerId");
CREATE INDEX "MatchLineupPlayer_playerId_idx"
  ON "MatchLineupPlayer"("playerId");
CREATE INDEX "MatchLineupPlayer_lineupId_status_idx"
  ON "MatchLineupPlayer"("lineupId", "status");

ALTER TABLE "MatchLineup"
  ADD CONSTRAINT "MatchLineup_matchId_fkey"
  FOREIGN KEY ("matchId") REFERENCES "Match"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchLineup"
  ADD CONSTRAINT "MatchLineup_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchLineupPlayer"
  ADD CONSTRAINT "MatchLineupPlayer_lineupId_fkey"
  FOREIGN KEY ("lineupId") REFERENCES "MatchLineup"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "MatchLineupPlayer"
  ADD CONSTRAINT "MatchLineupPlayer_playerId_fkey"
  FOREIGN KEY ("playerId") REFERENCES "Player"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
