import { prisma } from "@/lib/prisma";
import { generateTemporaryPassword, slugifyUsername } from "@/lib/credentials";
import { hashPassword } from "@/lib/session";

export type CreatedBootstrapAccount = {
  username: string;
  password: string;
  role: string;
  team: string;
};

export async function bootstrapInitialAccounts(): Promise<
  CreatedBootstrapAccount[] | null
> {
  return prisma.$transaction(async (tx) => {
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

    const accounts: CreatedBootstrapAccount[] = [];
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
      const base = `arbitro.${
        slugifyUsername(referee.name) || referee.id.slice(0, 6)
      }`;
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
}