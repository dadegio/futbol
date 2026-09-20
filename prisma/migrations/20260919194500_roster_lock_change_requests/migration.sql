CREATE TYPE "TeamChangeRequestType" AS ENUM ('TEAM_UPDATE', 'PLAYER_ADD', 'PLAYER_UPDATE', 'PLAYER_REMOVE', 'PLAYER_NUMBER_SWAP');
CREATE TYPE "TeamChangeRequestStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

CREATE TABLE "TeamChangeRequest" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "requestedById" TEXT NOT NULL,
  "reviewedById" TEXT,
  "targetPlayerId" TEXT,
  "type" "TeamChangeRequestType" NOT NULL,
  "status" "TeamChangeRequestStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "reason" TEXT,
  "reviewNote" TEXT,
  "reviewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TeamChangeRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "TeamChangeRequest_leagueId_status_createdAt_idx" ON "TeamChangeRequest"("leagueId", "status", "createdAt");
CREATE INDEX "TeamChangeRequest_teamId_status_createdAt_idx" ON "TeamChangeRequest"("teamId", "status", "createdAt");
CREATE INDEX "TeamChangeRequest_requestedById_createdAt_idx" ON "TeamChangeRequest"("requestedById", "createdAt");
CREATE INDEX "TeamChangeRequest_targetPlayerId_idx" ON "TeamChangeRequest"("targetPlayerId");

ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamChangeRequest" ADD CONSTRAINT "TeamChangeRequest_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
