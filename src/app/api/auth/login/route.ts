import { NextResponse } from "next/server";
import { COOKIE_NAME, SESSION_TTL_SECONDS } from "@/lib/session";
import { authenticateUser } from "@/modules/auth/application/authenticate-user";
import { apiErrorResponse, readJsonBody } from "@/modules/core/api";
import { rateLimit, getClientIp } from "@/modules/core/security/rate-limit";
import { normalizeUsername } from "@/modules/core/security/user-input";

export async function POST(req: Request) {
  const body = await readJsonBody<Record<string, unknown>>(req);
  const username = normalizeUsername(body?.username);

  const limited = rateLimit({
    key: `auth:login:${getClientIp(req)}:${username || "unknown"}`,
    limit: 12,
    windowMs: 15 * 60 * 1000,
    message: "Troppi tentativi di login. Riprova tra qualche minuto.",
  });
  if (limited) return limited;

  try {
    const { token, user } = await authenticateUser({
      username,
      password: body?.password,
    });

    const response = NextResponse.json({ user });
    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: SESSION_TTL_SECONDS,
    });
    return response;
  } catch (error) {
    return apiErrorResponse(error, "Errore interno di autenticazione");
  }
}
