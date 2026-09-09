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
  if (role === "CAPTAIN" && !teamId) {
    throw new AppError(400, "Specifica teamId per un capitano");
  }
  if (role === "REFEREE" && !refereeId) {
    throw new AppError(400, "Seleziona l'arbitro da collegare all'account");
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
        leagueId: role === "LEAGUE_ADMIN" || role === "CREATOR" ? leagueId : null,
        teamId: role === "CAPTAIN" ? teamId : null,
        refereeId: role === "REFEREE" ? refereeId : null,
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
      leagueId: user.leagueId ?? null,
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