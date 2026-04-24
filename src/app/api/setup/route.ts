/**
 * One-time setup endpoint.
 * Creates the admin account and one captain account per existing team.
 * Only works if no users exist yet (idempotent / safe to re-run check).
 *
 * Call once:  POST /api/setup   (no body needed)
 * Response:   table of created credentials
 */
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/session";

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
  const adminPassword = "admin123";
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

    const password = username; // initial password = username
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
