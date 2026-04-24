/**
 * One-time setup endpoint.
 * Creates the admin account and one captain account per existing team.
 * Only works if no users exist yet (idempotent / safe to re-run check).
 *
 * Call once:  POST /api/setup   (no body needed)
 * Response:   table of created credentials
 */
import crypto from "crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/session";

/** 12-character random password: letters + digits + a symbol. ~71 bits of entropy. */
function randomPassword(): string {
  const chars = "abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const symbols = "!@#$%&*";
  // 10 random alphanumeric + 1 symbol + 1 digit, then shuffle
  const bytes = crypto.randomBytes(12);
  const base = Array.from({ length: 10 }, (_, i) => chars[bytes[i]! % chars.length]);
  base.push(symbols[bytes[10]! % symbols.length]!);
  base.push(String(bytes[11]! % 10));
  // Fisher-Yates shuffle using more random bytes
  const shuffle = crypto.randomBytes(12);
  for (let i = base.length - 1; i > 0; i--) {
    const j = shuffle[i]! % (i + 1);
    [base[i], base[j]] = [base[j]!, base[i]!];
  }
  return base.join("");
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[àáâã]/g, "a")
    .replace(/[èéêë]/g, "e")
    .replace(/[ìíîï]/g, "i")
    .replace(/[òóôõ]/g, "o")
    .replace(/[ùúûü]/g, "u")
    .replace(/[^a-z0-9]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "");
}

export async function POST() {
  // Guard: only run if no users exist
  const existing = await prisma.user.count();
  if (existing > 0) {
    return NextResponse.json(
      { error: "Setup già eseguito. Utenti esistenti trovati." },
      { status: 409 }
    );
  }

  const teams = await prisma.team.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const results: { username: string; password: string; role: string; team: string }[] = [];

  // Create admin
  const adminPassword = randomPassword();
  await prisma.user.create({
    data: {
      username: "admin",
      passwordHash: hashPassword(adminPassword),
      role: "ADMIN",
      teamId: null,
    },
  });
  results.push({ username: "admin", password: adminPassword, role: "ADMIN", team: "—" });

  // Create one captain per team
  const seen = new Set<string>();
  for (const team of teams) {
    let base = slugify(team.name) || `squadra_${team.id.slice(0, 6)}`;
    let username = base;
    let i = 2;
    while (seen.has(username)) {
      username = `${base}_${i++}`;
    }
    seen.add(username);

    const password = randomPassword();
    await prisma.user.create({
      data: {
        username,
        passwordHash: hashPassword(password),
        role: "CAPTAIN",
        teamId: team.id,
      },
    });
    results.push({ username, password, role: "CAPTAIN", team: team.name });
  }

  return NextResponse.json({ ok: true, accounts: results });
}
