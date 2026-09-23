import "server-only";

import { cookies, headers } from "next/headers";
import { COOKIE_NAME, parseToken, type SessionUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";

/**
 * Server-side session reader.
 *
 * HttpOnly cookie is the canonical session transport. Bearer remains accepted
 * temporarily so existing browser sessions and API clients can migrate without
 * an abrupt logout.
 */
async function hydrateSession(session: SessionUser | null): Promise<SessionUser | null> {
  if (!session || session.role !== "CAPTAIN") return session;

  const assignments = await prisma.captainAssignment.findMany({
    where: { userId: session.userId },
    select: { leagueId: true, teamId: true },
    orderBy: { createdAt: "asc" },
  });

  return {
    ...session,
    captainAssignments: assignments.length
      ? assignments
      : session.teamId && session.leagueId
        ? [{ leagueId: session.leagueId, teamId: session.teamId }]
        : [],
  };
}

export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = parseToken(cookieToken);
    if (session) return hydrateSession(session);
  }

  const headersList = await headers();
  const auth = headersList.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return hydrateSession(parseToken(auth.slice(7)));
}

export type { SessionUser };
