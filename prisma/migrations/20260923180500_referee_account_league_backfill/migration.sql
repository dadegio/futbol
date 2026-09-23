-- Keep referee accounts scoped to the league of the linked referee.
UPDATE "User" AS u
SET "leagueId" = r."leagueId"
FROM "Referee" AS r
WHERE
  u."role" = 'REFEREE'
  AND u."refereeId" = r."id"
  AND u."leagueId" IS DISTINCT FROM r."leagueId";
