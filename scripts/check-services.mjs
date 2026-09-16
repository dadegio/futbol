#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const errors = [];
const warnings = [];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function fail(message) {
  errors.push(message);
}

function warn(message) {
  warnings.push(message);
}

function mustExist(relativePath) {
  if (!exists(relativePath)) fail(`File mancante: ${relativePath}`);
}

function mustContain(relativePath, fragments) {
  if (!exists(relativePath)) return;
  const content = read(relativePath);
  for (const fragment of fragments) {
    if (!content.includes(fragment)) fail(`${relativePath} non contiene: ${fragment}`);
  }
}

mustExist("src/modules/core/errors.ts");
mustExist("src/modules/leagues/application/league-overview-service.ts");
mustExist("src/app/api/leagues/[leagueId]/overview/route.ts");
mustExist("src/modules/matches/application/league-schedule-service.ts");
mustExist("src/modules/matches/application/calendar-reschedule-service.ts");
mustExist("src/modules/media/application/media-storage.ts");
mustExist("src/modules/auth/application/authenticate-user.ts");
mustExist("src/modules/auth/application/bootstrap-service.ts");
mustExist("src/modules/players/application/player-service.ts");
mustExist("src/modules/teams/application/team-service.ts");
mustExist("src/modules/fields/application/field-service.ts");
mustExist("src/modules/referees/application/referee-service.ts");
mustExist("src/modules/bookings/application/slot-service.ts");
mustExist("src/modules/admin/application/user-service.ts");
mustExist("src/modules/media/application/creator-service.ts");
mustExist("src/modules/matches/application/match-detail-service.ts");
mustExist("src/modules/matches/domain/scheduler.ts");
mustExist("src/modules/players/domain/tournament-rules.ts");
mustExist("src/modules/stats/domain/league-table.ts");
mustExist("scripts/run-domain-tests.mjs");
mustExist("prisma/migrations/20260908172000_performance_indexes/migration.sql");

mustContain("src/app/api/leagues/[leagueId]/overview/route.ts", [
  "getLeagueOverview",
  "publicApiCacheHeaders",
]);

mustContain("src/app/api/leagues/[leagueId]/schedule/route.ts", [
  "getLeagueSchedule",
  "createLeagueSchedule",
  "apiErrorResponse",
]);

mustContain("src/modules/matches/application/league-schedule-service.ts", [
  "generateRoundRobin",
  "rebalanceLeagueReferees",
  "getFieldSlotOccurrences",
  "rescheduleLeagueSchedule",
]);

mustContain("src/modules/matches/application/calendar-reschedule-service.ts", [
  "getSlotWeekDistance",
  "shiftSlotWeek",
  "refereeManualOverride",
  "homeSheetConfirmed",
]);

mustContain("src/modules/media/application/media-storage.ts", [
  "BLOB_READ_WRITE_TOKEN",
  "storeUploadFile",
  "local_public",
  "vercel_blob",
]);

mustContain("src/modules/auth/server-session.ts", [
  "COOKIE_NAME",
  "cookies()",
  "Authorization",
]);

mustContain("src/app/api/auth/login/route.ts", [
  "response.cookies.set",
  "COOKIE_NAME",
  "authenticateUser",
]);

mustContain("prisma/schema.prisma", [
  "@@index([leagueId, seriesId, date])",
  "@@index([leagueId, active, sortOrder])",
  "@@index([leagueId, status, createdAt])",
  "@@index([teamId, status])",
]);

mustContain("prisma/migrations/20260908172000_performance_indexes/migration.sql", [
  "Match_leagueId_seriesId_date_idx",
  "Sponsor_leagueId_active_sortOrder_idx",
  "MediaItem_leagueId_status_createdAt_idx",
  "Player_teamId_status_idx",
]);

if (exists("next.config.ts")) {
  const nextConfig = read("next.config.ts");
  if (!nextConfig.includes("/api/leagues/:leagueId/overview")) {
    warn("next.config.ts non contiene una regola esplicita per la cache dell'overview; la route imposta comunque gli header.");
  }
}

if (warnings.length) {
  console.warn("\n[services] Avvisi:");
  for (const warning of warnings) console.warn(`- ${warning}`);
}

if (errors.length) {
  console.error("\n[services] Errori:");
  for (const error of errors) console.error(`- ${error}`);
  process.exit(1);
}

console.log("[services] Controllo completato.");
