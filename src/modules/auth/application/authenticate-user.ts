import { prisma } from "@/lib/prisma";
import {
  createToken,
  verifyPassword,
  type SessionUser,
} from "@/lib/session";
import { AppError } from "@/modules/core/errors";
import {
  isValidUsername,
  normalizeUsername,
} from "@/modules/core/security/user-input";

export type AuthenticatedSession = {
  token: string;
  user: SessionUser;
};

export async function authenticateUser(input: {
  username: unknown;
  password: unknown;
}): Promise<AuthenticatedSession> {
  const username = normalizeUsername(input.username);
  const password = String(input.password ?? "");

  if (!username || !password) {
    throw new AppError(400, "Username e password sono obbligatori");
  }

  if (!isValidUsername(username)) {
    throw new AppError(401, "Credenziali non valide");
  }

  const user = await prisma.user.findUnique({
    where: { username },
    include: {
      captainAssignments: {
        select: { leagueId: true, teamId: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!user || !verifyPassword(password, user.passwordHash)) {
    throw new AppError(401, "Credenziali non valide");
  }

  const sessionUser: SessionUser = {
    userId: user.id,
    username: user.username,
    role: user.role as SessionUser["role"],
    teamId: user.teamId ?? null,
    refereeId: user.refereeId ?? null,
    leagueId: user.leagueId ?? null,
    captainAssignments:
      user.role === "CAPTAIN"
        ? user.captainAssignments.length
          ? user.captainAssignments
          : user.teamId && user.leagueId
            ? [{ leagueId: user.leagueId, teamId: user.teamId }]
            : []
        : [],
  };

  return {
    token: createToken(sessionUser),
    user: sessionUser,
  };
}