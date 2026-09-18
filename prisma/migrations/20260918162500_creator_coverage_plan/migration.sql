-- Structured weekly media coverage: PHOTO / VIDEO roles, per-creator weekly limits,
-- one optional VEO team per league, and a role on every creator-match assignment.
CREATE TYPE "CreatorCoverageRole" AS ENUM ('PHOTO', 'VIDEO', 'BOTH');
CREATE TYPE "CreatorAssignmentRole" AS ENUM ('PHOTO', 'VIDEO');

ALTER TABLE "League"
ADD COLUMN "veoTeamId" TEXT;

ALTER TABLE "CreatorProfile"
ADD COLUMN "coverageRole" "CreatorCoverageRole" NOT NULL DEFAULT 'PHOTO',
ADD COLUMN "weeklyAssignmentLimit" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "CreatorMatchAssignment"
ADD COLUMN "role" "CreatorAssignmentRole" NOT NULL DEFAULT 'PHOTO';

ALTER TABLE "CreatorProfile"
ADD CONSTRAINT "CreatorProfile_weeklyAssignmentLimit_check"
CHECK ("weeklyAssignmentLimit" >= 1 AND "weeklyAssignmentLimit" <= 7);

CREATE INDEX "CreatorMatchAssignment_matchId_role_idx"
ON "CreatorMatchAssignment"("matchId", "role");

-- Initial defaults for the current Cammino Imperiale crew. Matching only the
-- first token keeps the migration useful even when a surname is displayed.
UPDATE "CreatorProfile"
SET "coverageRole" = 'PHOTO', "weeklyAssignmentLimit" = 1
WHERE LOWER(split_part(trim("displayName"), ' ', 1)) IN ('leonardo', 'luca', 'claudia');

UPDATE "CreatorProfile"
SET "coverageRole" = 'PHOTO', "weeklyAssignmentLimit" = 2
WHERE LOWER(split_part(trim("displayName"), ' ', 1)) = 'matteo';

UPDATE "CreatorProfile"
SET "coverageRole" = 'VIDEO', "weeklyAssignmentLimit" = 2
WHERE LOWER(split_part(trim("displayName"), ' ', 1)) IN ('rock', 'andrei');
