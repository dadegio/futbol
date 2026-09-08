-- Performance indexes for multi-tournament public pages and admin history.
-- These are additive and do not change application behavior.

CREATE INDEX "Sponsor_leagueId_active_sortOrder_idx" ON "Sponsor"("leagueId", "active", "sortOrder");

CREATE INDEX "MediaItem_leagueId_status_createdAt_idx" ON "MediaItem"("leagueId", "status", "createdAt");
CREATE INDEX "MediaItem_leagueId_featured_createdAt_idx" ON "MediaItem"("leagueId", "featured", "createdAt");
CREATE INDEX "MediaItem_leagueId_type_status_idx" ON "MediaItem"("leagueId", "type", "status");

CREATE INDEX "Player_teamId_status_idx" ON "Player"("teamId", "status");

CREATE INDEX "Match_leagueId_seriesId_date_idx" ON "Match"("leagueId", "seriesId", "date");
CREATE INDEX "Match_leagueId_seriesId_round_idx" ON "Match"("leagueId", "seriesId", "round");
