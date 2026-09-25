import { prisma } from "@/lib/prisma";
import { hashPassword, type SessionUser } from "@/lib/session";
import { writeAuditLog } from "@/modules/audit/application/audit-service";
import { AppError } from "@/modules/core/errors";
import {
  isValidUsername,
  normalizeUsername,
  passwordPolicyError,
} from "@/modules/core/security/user-input";

const USER_ROLES = new Set([
  "ADMIN",
  "LEAGUE_ADMIN",
  "CAPTAIN",
  "COACH",
  "REFEREE",
  "CREATOR",
]);

export async function listUsers() {
  return prisma.user.findMany({
    select: {
      id: true,
      username: true,
      role: true,
      teamId: true,
      refereeId: true,
      leagueId: true,
      adminLeague: { select: { name: true } },
      team: { select: { name: true } },
      captainAssignments: {
        select: {
          id: true,
          leagueId: true,
          teamId: true,
          league: { select: { name: true } },
          team: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      coachAssignments: {
        select: {
          id: true,
          leagueId: true,
          teamId: true,
          league: { select: { name: true } },
          team: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
      },
      referee: {
        select: { name: true, league: { select: { name: true } } },
      },
      creatorProfile: {
        select: {
          displayName: true,
          roleLabel: true,
          league: { select: { name: true } },
        },
      },
      createdAt: true,
    },
    orderBy: [{ role: "asc" }, { username: "asc" }],
  });
}

export async function createUser({
  input,
  actor,
}: {
  input: Record<string, unknown>;
  actor: SessionUser | null;
}) {
  const normalizedUsername = normalizeUsername(input.username);
  const password = String(input.password ?? "");
  const role = String(input.role ?? "");
  const teamId = input.teamId ? String(input.teamId) : null;
  const refereeId = input.refereeId ? String(input.refereeId) : null;
  const leagueId = input.leagueId ? String(input.leagueId) : null;

  if (!normalizedUsername) throw new AppError(400, "Username obbligatorio");
  if (!isValidUsername(normalizedUsername)) {
    throw new AppError(
      400,
      "Username: 3-40 caratteri, solo lettere minuscole, numeri, punto, trattino e underscore"
    );
  }
  const passwordError = passwordPolicyError(password, 8);
  if (passwordError) throw new AppError(400, passwordError);
  if (!USER_ROLES.has(role)) throw new AppError(400, "Ruolo non valido");
  if ((role === "LEAGUE_ADMIN" || role === "CREATOR") && !leagueId) {
    throw new AppError(
      400,
      role === "CREATOR"
        ? "Seleziona il torneo del creator"
        : "Seleziona il torneo da amministrare"
    );
  }
  if ((role === "CAPTAIN" || role === "COACH") && !teamId) {
    throw new AppError(
      400,
      role === "COACH" ? "Seleziona la squadra dell'allenatore" : "Specifica teamId per un capitano"
    );
  }
  if (role === "REFEREE" && !refereeId) {
    throw new AppError(400, "Seleziona l'arbitro da collegare all'account");
  }

  const staffTeam =
    (role === "CAPTAIN" || role === "COACH") && teamId
      ? await prisma.team.findUnique({
          where: { id: teamId },
          select: { leagueId: true },
        })
      : null;
  if ((role === "CAPTAIN" || role === "COACH") && !staffTeam) {
    throw new AppError(400, "Squadra non valida");
  }

  const refereeLeague =
    role === "REFEREE" && refereeId
      ? await prisma.referee.findUnique({
          where: { id: refereeId },
          select: { leagueId: true },
        })
      : null;
  if (role === "REFEREE" && !refereeLeague) {
    throw new AppError(400, "Arbitro non valido");
  }

  const existing = await prisma.user.findUnique({
    where: { username: normalizedUsername },
  });
  if (existing) throw new AppError(409, "Username già in uso");

  try {
    const user = await prisma.user.create({
      data: {
        username: normalizedUsername,
        passwordHash: hashPassword(password),
        role: role as SessionUser["role"],
        leagueId:
          role === "LEAGUE_ADMIN" || role === "CREATOR"
            ? leagueId
            : role === "REFEREE"
              ? refereeLeague?.leagueId ?? null
              : null,
        teamId: role === "CAPTAIN" ? teamId : null,
        refereeId: role === "REFEREE" ? refereeId : null,
        captainAssignments:
          role === "CAPTAIN" && teamId && staffTeam
            ? { create: { teamId, leagueId: staffTeam.leagueId } }
            : undefined,
        coachAssignments:
          role === "COACH" && teamId && staffTeam
            ? { create: { teamId, leagueId: staffTeam.leagueId } }
            : undefined,
        creatorProfile:
          role === "CREATOR" && leagueId
            ? {
                create: {
                  leagueId,
                  displayName: normalizedUsername,
                  roleLabel: "Creator",
                },
              }
            : undefined,
      },
      select: {
        id: true,
        username: true,
        role: true,
        teamId: true,
        refereeId: true,
        leagueId: true,
        createdAt: true,
      },
    });

    await writeAuditLog({
      leagueId: user.leagueId ?? staffTeam?.leagueId ?? null,
      actor,
      action: "user.created",
      entityType: "user",
      entityId: user.id,
      summary: `Creato utente ${user.username} (${user.role})`,
      metadata: {
        role: user.role,
        teamId: user.teamId,
        refereeId: user.refereeId,
        leagueId: user.leagueId,
      },
    });

    return user;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(
        409,
        role === "REFEREE"
          ? "Questo arbitro ha già un account"
          : "Squadra o username già associati a un account"
      );
    }
    throw error;
  }
}

export async function addCaptainAssignment({
  userId,
  teamId,
  actor,
}: {
  userId: string;
  teamId: string;
  actor: SessionUser | null;
}) {
  const [user, team] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, include: { captainAssignments: true } }),
    prisma.team.findUnique({ where: { id: teamId }, select: { id: true, leagueId: true, name: true } }),
  ]);
  if (!user) throw new AppError(404, "Utente non trovato");
  if (user.role !== "CAPTAIN") throw new AppError(400, "L'utente non è un capitano");
  if (!team) throw new AppError(404, "Squadra non trovata");
  if (user.captainAssignments.some((assignment) => assignment.leagueId === team.leagueId)) {
    throw new AppError(409, "Il capitano ha già una squadra associata in questo torneo");
  }

  try {
    const assignment = await prisma.$transaction(async (tx) => {
      const created = await tx.captainAssignment.create({
        data: { userId, teamId, leagueId: team.leagueId },
        include: { team: { select: { name: true } }, league: { select: { name: true } } },
      });
      if (!user.teamId) {
        await tx.user.update({ where: { id: userId }, data: { teamId } });
      }
      return created;
    });

    await writeAuditLog({
      leagueId: team.leagueId,
      actor,
      action: "user.captain_assignment_added",
      entityType: "user",
      entityId: userId,
      summary: `Associato capitano ${user.username} a ${team.name}`,
      metadata: { teamId, leagueId: team.leagueId },
    });
    return assignment;
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      throw new AppError(409, "Questa squadra ha già un account capitano");
    }
    throw error;
  }
}

export async function removeCaptainAssignment({
  userId,
  assignmentId,
  actor,
}: {
  userId: string;
  assignmentId: string;
  actor: SessionUser | null;
}) {
  const assignment = await prisma.captainAssignment.findFirst({
    where: { id: assignmentId, userId },
    include: { user: true, team: { select: { name: true } } },
  });
  if (!assignment) throw new AppError(404, "Associazione capitano non trovata");

  await prisma.$transaction(async (tx) => {
    await tx.captainAssignment.delete({ where: { id: assignment.id } });
    if (assignment.user.teamId === assignment.teamId) {
      const next = await tx.captainAssignment.findFirst({
        where: { userId },
        orderBy: { createdAt: "asc" },
        select: { teamId: true },
      });
      await tx.user.update({
        where: { id: userId },
        data: { teamId: next?.teamId ?? null },
      });
    }
  });

  await writeAuditLog({
    leagueId: assignment.leagueId,
    actor,
    action: "user.captain_assignment_removed",
    entityType: "user",
    entityId: userId,
    summary: `Rimossa associazione capitano ${assignment.user.username} da ${assignment.team.name}`,
    metadata: { teamId: assignment.teamId, leagueId: assignment.leagueId },
  });
  return { ok: true };
}

export async function updateUserPassword({
  userId,
  password,
  actor,
}: {
  userId: string | null;
  password: unknown;
  actor: SessionUser | null;
}) {
  if (!userId) throw new AppError(400, "Parametro id mancante");
  const nextPassword = typeof password === "string" ? password : "";
  const passwordError = passwordPolicyError(nextPassword, 8);
  if (passwordError) throw new AppError(400, passwordError);

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "Utente non trovato");

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: hashPassword(nextPassword) },
  });
  await writeAuditLog({
    leagueId: user.leagueId ?? null,
    actor,
    action: "user.password_updated",
    entityType: "user",
    entityId: userId,
    summary: `Aggiornata password utente ${user.username}`,
  });
  return { ok: true };
}

export async function deleteUser({
  userId,
  actor,
}: {
  userId: string | null;
  actor: SessionUser | null;
}) {
  if (!userId) throw new AppError(400, "Parametro id mancante");
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError(404, "Utente non trovato");

  if (user.role === "ADMIN") {
    const adminCount = await prisma.user.count({ where: { role: "ADMIN" } });
    if (adminCount <= 1) {
      throw new AppError(400, "Impossibile eliminare l'unico account admin");
    }
  }

  await prisma.user.delete({ where: { id: userId } });
  await writeAuditLog({
    leagueId: user.leagueId ?? null,
    actor,
    action: "user.deleted",
    entityType: "user",
    entityId: userId,
    summary: `Eliminato utente ${user.username}`,
    metadata: { role: user.role },
  });
  return { ok: true };
}