import type { Role, SessionUser } from "@/lib/session";

export type Permission =
  | "league:view"
  | "league:update"
  | "league:delete"
  | "league:create"
  | "team:manage"
  | "player:manage"
  | "match:edit"
  | "booking:create"
  | "booking:override"
  | "field:manage"
  | "referee:manage"
  | "sponsor:manage"
  | "media:create"
  | "media:approve"
  | "users:manage"
  | "platform:manage";

export type PermissionContext = {
  leagueId?: string | null;
  teamId?: string | null;
  matchTeamIds?: string[];
  refereeId?: string | null;
  assignedRefereeId?: string | null;
};

export function isSuperAdmin(user: Pick<SessionUser, "role"> | null | undefined) {
  return user?.role === "ADMIN";
}

export function isLeagueAdmin(
  user: Pick<SessionUser, "role" | "leagueId"> | null | undefined,
  leagueId: string | null | undefined
) {
  return Boolean(
    user &&
      leagueId &&
      (user.role === "ADMIN" ||
        (user.role === "LEAGUE_ADMIN" && user.leagueId === leagueId))
  );
}

export function isCreator(
  user: Pick<SessionUser, "role" | "leagueId"> | null | undefined,
  leagueId: string | null | undefined
) {
  return Boolean(user?.role === "CREATOR" && leagueId && user.leagueId === leagueId);
}

function captainAssignments(user: Pick<SessionUser, "teamId" | "leagueId" | "captainAssignments">) {
  if (user.captainAssignments?.length) return user.captainAssignments;
  return user.teamId && user.leagueId
    ? [{ teamId: user.teamId, leagueId: user.leagueId }]
    : [];
}

export function isCaptainOfTeam(
  user: Pick<SessionUser, "role" | "teamId" | "leagueId" | "captainAssignments"> | null | undefined,
  teamId: string | null | undefined
) {
  return Boolean(
    user?.role === "CAPTAIN" &&
      teamId &&
      captainAssignments(user).some((assignment) => assignment.teamId === teamId)
  );
}

export function isRefereeAssignedToMatch(
  user: Pick<SessionUser, "role" | "refereeId"> | null | undefined,
  assignedRefereeId: string | null | undefined
) {
  return Boolean(
    user?.role === "REFEREE" &&
      user.refereeId &&
      assignedRefereeId &&
      user.refereeId === assignedRefereeId
  );
}

export function roleLabel(role: Role) {
  switch (role) {
    case "ADMIN":
      return "Super Admin";
    case "LEAGUE_ADMIN":
      return "Admin torneo";
    case "CAPTAIN":
      return "Capitano";
    case "REFEREE":
      return "Arbitro";
    case "CREATOR":
      return "Creator";
    default:
      return role;
  }
}

export function canPerform(
  user: SessionUser | null | undefined,
  permission: Permission,
  context: PermissionContext = {}
) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;

  const leagueScoped = Boolean(
    context.leagueId &&
      (user.leagueId === context.leagueId ||
        (user.role === "CAPTAIN" &&
          captainAssignments(user).some((assignment) => assignment.leagueId === context.leagueId)))
  );

  if (user.role === "LEAGUE_ADMIN" && leagueScoped) {
    return [
      "league:view",
      "league:update",
      "team:manage",
      "player:manage",
      "match:edit",
      "booking:create",
      "booking:override",
      "field:manage",
      "referee:manage",
      "sponsor:manage",
      "media:create",
      "media:approve",
    ].includes(permission);
  }

  if (user.role === "CAPTAIN") {
    const teamIds = new Set(captainAssignments(user).map((assignment) => assignment.teamId));
    if (permission === "league:view") return leagueScoped;
    if (permission === "booking:create") {
      return Boolean(
        context.matchTeamIds?.some((teamId) => teamIds.has(teamId)) ||
          (context.teamId && teamIds.has(context.teamId))
      );
    }
    if (permission === "team:manage" || permission === "player:manage") {
      return Boolean(context.teamId && teamIds.has(context.teamId));
    }
  }

  if (user.role === "REFEREE") {
    if (permission === "league:view") return leagueScoped;
    if (permission === "match:edit") {
      return Boolean(
        user.refereeId &&
          context.assignedRefereeId &&
          user.refereeId === context.assignedRefereeId
      );
    }
  }

  if (user.role === "CREATOR") {
    if (permission === "league:view") return leagueScoped;
    if (permission === "media:create") return leagueScoped;
  }

  return false;
}
