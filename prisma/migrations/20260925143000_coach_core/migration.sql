ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'COACH';

CREATE TABLE "CoachAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "leagueId" TEXT NOT NULL,
  "teamId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CoachAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoachAssignment_teamId_key" ON "CoachAssignment"("teamId");
CREATE UNIQUE INDEX "CoachAssignment_userId_leagueId_key" ON "CoachAssignment"("userId", "leagueId");
CREATE INDEX "CoachAssignment_userId_idx" ON "CoachAssignment"("userId");
CREATE INDEX "CoachAssignment_leagueId_idx" ON "CoachAssignment"("leagueId");

ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CoachAssignment" ADD CONSTRAINT "CoachAssignment_teamId_fkey"
  FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;
