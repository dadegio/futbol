import { NextResponse } from "next/server";

import { AppError } from "@/modules/core/errors";
export { AppError } from "@/modules/core/errors";

export function jsonOk<T extends Record<string, unknown>>(payload: T, status = 200) {
  return NextResponse.json(payload, { status });
}

export function jsonError(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, ...(code ? { code } : {}) }, { status });
}

export async function readJsonBody<T = unknown>(req: Request): Promise<T> {
  return (await req.json().catch(() => ({}))) as T;
}

export function apiErrorResponse(error: unknown, fallback = "Errore interno") {
  if (error instanceof AppError) {
    return jsonError(error.message, error.status, error.code);
  }

  // Non esporre dettagli interni al client, ma conservarli nei log server/Vercel
  // per rendere diagnosticabili errori Prisma, mismatch di schema e problemi runtime.
  console.error(`[api] ${fallback}:`, error);
  return jsonError(fallback, 500, "INTERNAL_ERROR");
}

export function assertOrThrow(condition: unknown, status: number, message: string, code?: string): asserts condition {
  if (!condition) throw new AppError(status, message, code);
}
