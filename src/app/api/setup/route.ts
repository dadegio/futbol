/**
 * One-time bootstrap endpoint.
 *
 * In production SETUP_SECRET is mandatory and must be supplied through the
 * x-setup-secret header. All generated accounts are created in one database
 * transaction so a partial failure cannot leave the application half set up.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/session";
import { ipRateLimit } from "@/modules/core/security/rate-limit";
import {
  generateTemporaryPassword,
  slugifyUsername,
} from "@/lib/credentials";

type CreatedAccount = {
  username: string;
  password: string;
  role: string;
  team: string;
};

function safeSecretEquals(actual: string, expected: string) {
  const actualBuffer = Buffer.from(actual);
  const expectedBuffer = Buffer.from(expected);
  if (actualBuffer.length !== expectedBuffer.length) return false;
  return timingSafeEqual(actualBuffer, expectedBuffer);
}

function requireSetupSecret(req: Request): NextResponse | null {
  const expected = process.env.SETUP_SECRET?.trim() ?? "";

  if (!expected) {
    if (process.env.NODE_ENV === "production") {
      return NextResponse.json(
        { error: "Setup disabilitato: SETUP_SECRET non configurato." },
        { status: 503 }
      );
    }
    return null;
  }

  const actual = req.headers.get("x-setup-secret")?.trim() ?? "";
  if (!actual || !safeSecretEquals(actual, expected)) {
    return NextResponse.json({ error: "Setup secret non valido." }, { status: 401 });
  }

  return null;
}

export async function POST(req: Request) {
  const limited = ipRateLimit(req, "setup", {
    limit: 5,
    windowMs: 60 * 60 * 1000,
    message: "Troppi tentativi di setup. Riprova più tardi.",
  });
  if (limited) return limited;

  const secretError = requireSetupSecret(req);
  if (secretError) return secretError;

  try {
    const results = await prisma.$transaction(async (tx) => {
      const existing = await tx.user.count();
      if (existing > 0) return null;

      const teams = await tx.team.findMany({
        where: { activeInLeague: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });
      const referees = await tx.referee.findMany({
        where: { active: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      });

      const accounts: CreatedAccount[] = [];
      const seen = new Set<string>(["admin"]);

      const adminPassword = generateTemporaryPassword();
      await tx.user.create({
        data: {
          username: "admin",
          passwordHash: hashPassword(adminPassword),
          role: "ADMIN",
          teamId: null,
        },
      });
      accounts.push({
        username: "admin",
        password: adminPassword,
        role: "ADMIN",
        team: "—",
      });

      for (const team of teams) {
        const base = slugifyUsername(team.name) || `squadra_${team.id.slice(0, 6)}`;
        let username = base;
        let suffix = 2;
        while (seen.has(username)) username = `${base}_${suffix++}`;
        seen.add(username);

        const password = generateTemporaryPassword();
        await tx.user.create({
          data: {
            username,
            passwordHash: hashPassword(password),
            role: "CAPTAIN",
            teamId: team.id,
          },
        });
        accounts.push({ username, password, role: "CAPTAIN", team: team.name });
      }

      for (const referee of referees) {
        const base = `arbitro.${slugifyUsername(referee.name) || referee.id.slice(0, 6)}`;
        let username = base;
        let suffix = 2;
        while (seen.has(username)) username = `${base}.${suffix++}`;
        seen.add(username);

        const password = generateTemporaryPassword();
        await tx.user.create({
          data: {
            username,
            passwordHash: hashPassword(password),
            role: "REFEREE",
            refereeId: referee.id,
          },
        });
        accounts.push({
          username,
          password,
          role: "REFEREE",
          team: `Arbitro: ${referee.name}`,
        });
      }

      return accounts;
    });

    if (!results) {
      return NextResponse.json(
        { error: "Setup già eseguito. Utenti esistenti trovati." },
        { status: 409 }
      );
    }

    return NextResponse.json({ ok: true, accounts: results });
  } catch (error) {
    console.error("Bootstrap setup failed", error);
    return NextResponse.json(
      { error: "Setup non completato. Nessuna modifica parziale è stata mantenuta." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";
