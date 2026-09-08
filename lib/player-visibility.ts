import type { SessionUser } from "./session";
import {
  getPlayerAdminMissingItems,
  getPlayerRegistrationStatus,
  isPlayerEligibleForMatchSheet,
  type PlayerEligibilityInput,
} from "./tournament-rules";

export type PlayerVisibilityInput = PlayerEligibilityInput & {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position?: string | null;
  photoUrl?: string | null;
  photoZoom?: number;
  photoPositionX?: number;
  photoPositionY?: number;
  isTeamCaptain?: boolean;
  teamId?: string | null;
  team?: unknown;
  [key: string]: unknown;
};

export type SanitizedPlayer<T extends PlayerVisibilityInput = PlayerVisibilityInput> = {
  id: string;
  firstName: string;
  lastName: string;
  number: number;
  position: string | null;
  photoUrl: string | null;
  photoZoom: number;
  photoPositionX: number;
  photoPositionY: number;
  isTeamCaptain: boolean;
  teamId: string | null;
  team: T["team"];
  registrationStatus: ReturnType<typeof getPlayerRegistrationStatus>;
  isEligibleForMatchSheet: boolean;
  adminMissingItems?: string[];
} & Partial<T>;

export function canSeeAdminPlayerDetails(user: SessionUser | null | undefined, leagueId?: string | null) {
  return user?.role === "ADMIN" ||
    (user?.role === "LEAGUE_ADMIN" && Boolean(leagueId) && user.leagueId === leagueId);
}

export function canEditAdminPlayerDetails(user: SessionUser | null | undefined, leagueId?: string | null) {
  return canSeeAdminPlayerDetails(user, leagueId);
}

export function publicPlayerStatus(player: PlayerEligibilityInput) {
  return {
    registrationStatus: getPlayerRegistrationStatus(player),
    isEligibleForMatchSheet: isPlayerEligibleForMatchSheet(player),
  };
}

export function sanitizePlayerForRole<T extends PlayerVisibilityInput>(
  player: T,
  user: SessionUser | null | undefined,
  leagueId?: string | null
): SanitizedPlayer<T> {
  const status = publicPlayerStatus(player);

  const base: SanitizedPlayer<T> = {
    id: player.id,
    firstName: player.firstName,
    lastName: player.lastName,
    number: player.number,
    position: player.position ?? null,
    photoUrl: player.photoUrl ?? null,
    photoZoom: typeof player.photoZoom === "number" ? player.photoZoom : 1,
    photoPositionX: typeof player.photoPositionX === "number" ? player.photoPositionX : 50,
    photoPositionY: typeof player.photoPositionY === "number" ? player.photoPositionY : 50,
    isTeamCaptain: player.isTeamCaptain === true,
    teamId: player.teamId ?? null,
    team: player.team as T["team"],
    ...status,
  };

  if (canSeeAdminPlayerDetails(user, leagueId)) {
    return {
      ...player,
      ...status,
      adminMissingItems: getPlayerAdminMissingItems(player),
    } as SanitizedPlayer<T>;
  }

  return base;
}
