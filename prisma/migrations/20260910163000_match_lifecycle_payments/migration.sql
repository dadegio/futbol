CREATE TYPE "MatchLifecycleStatus" AS ENUM ('SCHEDULED', 'POSTPONED', 'CANCELLED');
CREATE TYPE "MatchResultStatus" AS ENUM ('DRAFT', 'FINAL');

ALTER TABLE "Match"
  ADD COLUMN "lifecycleStatus" "MatchLifecycleStatus" NOT NULL DEFAULT 'SCHEDULED',
  ADD COLUMN "originalDate" TIMESTAMP(3),
  ADD COLUMN "resultStatus" "MatchResultStatus",
  ADD COLUMN "finalizedAt" TIMESTAMP(3),
  ADD COLUMN "homeSheetConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "awaySheetConfirmed" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "mvpPlayerId" TEXT,
  ADD COLUMN "replayUrl" TEXT,
  ADD COLUMN "highlightsUrl" TEXT;

UPDATE "Match"
SET "resultStatus" = 'FINAL', "finalizedAt" = COALESCE("date", "createdAt")
WHERE "homeGoals" IS NOT NULL AND "awayGoals" IS NOT NULL;

ALTER TABLE "Match"
  ADD CONSTRAINT "Match_mvpPlayerId_fkey" FOREIGN KEY ("mvpPlayerId") REFERENCES "Player"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "Match_resultStatus_idx" ON "Match"("resultStatus");
CREATE INDEX "Match_lifecycleStatus_idx" ON "Match"("lifecycleStatus");
CREATE INDEX "Match_mvpPlayerId_idx" ON "Match"("mvpPlayerId");

CREATE TABLE "TeamFeePayment" (
  "id" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "note" TEXT,
  "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TeamFeePayment_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "TeamFeePayment" ADD CONSTRAINT "TeamFeePayment_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "TeamFeePayment" ADD CONSTRAINT "TeamFeePayment_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
CREATE INDEX "TeamFeePayment_leagueId_paidAt_idx" ON "TeamFeePayment"("leagueId", "paidAt");
CREATE INDEX "TeamFeePayment_teamId_paidAt_idx" ON "TeamFeePayment"("teamId", "paidAt");
