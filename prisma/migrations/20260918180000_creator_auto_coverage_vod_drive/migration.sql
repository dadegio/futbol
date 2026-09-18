-- Automatic creator coverage refinements:
-- - a second automatic video source tied to U.S. Tikkiu VOD/live recordings.
ALTER TABLE "League"
ADD COLUMN "vodTeamId" TEXT;

-- Seed the known automatic sources when matching teams already exist.
UPDATE "League" AS l
SET "veoTeamId" = t."id"
FROM "Team" AS t
WHERE l."veoTeamId" IS NULL
  AND t."leagueId" = l."id"
  AND t."activeInLeague" = true
  AND LOWER(TRIM(t."name")) = 'clockwork orange';

UPDATE "League" AS l
SET "vodTeamId" = t."id"
FROM "Team" AS t
WHERE l."vodTeamId" IS NULL
  AND t."leagueId" = l."id"
  AND t."activeInLeague" = true
  AND LOWER(REPLACE(TRIM(t."name"), '.', '')) = 'us tikkiu';
