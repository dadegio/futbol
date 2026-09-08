import "server-only";

import { cookies, headers } from "next/headers";
import { COOKIE_NAME, parseToken, type SessionUser } from "@/lib/session";

/**
 * Server-side session reader.
 *
 * HttpOnly cookie is the canonical session transport. Bearer remains accepted
 * temporarily so existing browser sessions and API clients can migrate without
 * an abrupt logout.
 */
export async function getServerSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const cookieToken = cookieStore.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const session = parseToken(cookieToken);
    if (session) return session;
  }

  const headersList = await headers();
  const auth = headersList.get("Authorization");
  if (!auth?.startsWith("Bearer ")) return null;
  return parseToken(auth.slice(7));
}

export type { SessionUser };
