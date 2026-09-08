import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { COOKIE_NAME, SESSION_TTL_SECONDS, parseToken } from "@/lib/session";
import { getServerSession } from "@/lib/server-auth";

export async function GET() {
  const user = await getServerSession();
  const response = NextResponse.json({ user: user ?? null });

  // One-time compatibility bridge for sessions created before the HttpOnly
  // cookie migration: accept the valid legacy Bearer token and persist it as
  // the canonical cookie. The client removes localStorage after this succeeds.
  if (user) {
    const headersList = await headers();
    const auth = headersList.get("Authorization");
    const legacyToken = auth?.startsWith("Bearer ") ? auth.slice(7) : null;
    if (legacyToken && parseToken(legacyToken)) {
      response.cookies.set(COOKIE_NAME, legacyToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: SESSION_TTL_SECONDS,
      });
    }
  }

  return response;
}
