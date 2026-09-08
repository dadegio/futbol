/**
 * One-time bootstrap endpoint.
 *
 * In production SETUP_SECRET is mandatory and must be supplied through the
 * x-setup-secret header. Account creation is delegated to an application
 * transaction so a partial failure cannot leave the application half set up.
 */
import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { bootstrapInitialAccounts } from "@/modules/auth/application/bootstrap-service";
import { ipRateLimit } from "@/modules/core/security/rate-limit";

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
    const accounts = await bootstrapInitialAccounts();
    if (!accounts) {
      return NextResponse.json(
        { error: "Setup già eseguito. Utenti esistenti trovati." },
        { status: 409 }
      );
    }
    return NextResponse.json({ ok: true, accounts });
  } catch (error) {
    console.error("Bootstrap setup failed", error);
    return NextResponse.json(
      { error: "Setup non completato. Nessuna modifica parziale è stata mantenuta." },
      { status: 500 }
    );
  }
}

export const runtime = "nodejs";