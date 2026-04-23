/*
  Warnings:

  - A unique constraint covering the columns `[seriesId,leg]` on the table `Match` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateEnum
CREATE TYPE "PlayoffFormat" AS ENUM ('SINGLE_ELIM', 'TWO_LEG');

-- DropIndex
DROP INDEX "Match_leagueId_round_homeTeamId_awayTeamId_key";

-- AlterTable
ALTER TABLE "League" ADD COLUMN     "playoffFormat" "PlayoffFormat",
ADD COLUMN     "playoffSeeded" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "playoffTeamCount" INTEGER;

-- AlterTable
ALTER TABLE "Match" ADD COLUMN     "leg" INTEGER,
ADD COLUMN     "seriesId" TEXT;

-- CreateTable
CREATE TABLE "PlayoffSeries" (
    "id" TEXT NOT NULL,
    "leagueId" TEXT NOT NULL,
    "bracketRound" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "homeTeamId" TEXT,
    "awayTeamId" TEXT,
    "homeSeed" INTEGER,
    "awaySeed" INTEGER,
    "winnerId" TEXT,
    "feedsIntoSeriesId" TEXT,

    CONSTRAINT "PlayoffSeries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PlayoffSeries_leagueId_idx" ON "PlayoffSeries"("leagueId");

-- CreateIndex
CREATE UNIQUE INDEX "PlayoffSeries_leagueId_bracketRound_position_key" ON "PlayoffSeries"("leagueId", "bracketRound", "position");

-- CreateIndex
CREATE INDEX "Match_seriesId_idx" ON "Match"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "Match_seriesId_leg_key" ON "Match"("seriesId", "leg");

-- AddForeignKey
ALTER TABLE "Match" ADD CONSTRAINT "Match_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "PlayoffSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_homeTeamId_fkey" FOREIGN KEY ("homeTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_awayTeamId_fkey" FOREIGN KEY ("awayTeamId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_winnerId_fkey" FOREIGN KEY ("winnerId") REFERENCES "Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayoffSeries" ADD CONSTRAINT "PlayoffSeries_feedsIntoSeriesId_fkey" FOREIGN KEY ("feedsIntoSeriesId") REFERENCES "PlayoffSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;
