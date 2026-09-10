import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/session";

type AuditActor = Pick<SessionUser, "userId" | "username" | "role"> | null | undefined;

type AuditMetadata = Record<string, unknown> | null | undefined;
type JsonPrimitive = string | number | boolean | null;
type SafeAuditMetadata = Record<string, JsonPrimitive | JsonPrimitive[]>;

export type WriteAuditLogInput = {
  leagueId?: string | null;
  actor?: AuditActor;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary?: string | null;
  metadata?: AuditMetadata;
};

export type ListAuditLogsInput = {
  leagueId: string;
  limit?: number;
  cursor?: string | null;
  action?: string | null;
  entityType?: string | null;
};

function clampLimit(value: number | undefined) {
  if (!value || Number.isNaN(value)) return 80;
  return Math.min(Math.max(Math.floor(value), 1), 200);
}

function normalizeText(value: string | null | undefined, max = 180) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  return raw.length > max ? `${raw.slice(0, max - 1)}…` : raw;
}

function sanitizeMetadata(metadata: AuditMetadata): SafeAuditMetadata | undefined {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return undefined;

  const safe: SafeAuditMetadata = {};
  for (const [key, value] of Object.entries(metadata)) {
    const normalizedKey = key.toLowerCase();
    if (
      normalizedKey.includes("password") ||
      normalizedKey.includes("token") ||
      normalizedKey.includes("secret") ||
      normalizedKey.includes("hash")
    ) {
      safe[key] = "[redacted]";
      continue;
    }

    if (value instanceof Date) {
      safe[key] = value.toISOString();
    } else if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value === null) {
      safe[key] = value;
    } else if (value === undefined) {
      safe[key] = null;
    } else if (Array.isArray(value)) {
      safe[key] = value.slice(0, 50).map((entry) =>
        typeof entry === "string" || typeof entry === "number" || typeof entry === "boolean" || entry === null
          ? entry
          : String(entry)
      );
    } else {
      safe[key] = String(value);
    }
  }

  return Object.keys(safe).length ? safe : undefined;
}

export async function writeAuditLog(input: WriteAuditLogInput) {
  try {
    const metadata = sanitizeMetadata(input.metadata);
    await prisma.auditLog.create({
      data: {
        leagueId: input.leagueId ?? null,
        actorUserId: input.actor?.userId ?? null,
        actorUsername: normalizeText(input.actor?.username, 80),
        actorRole: normalizeText(input.actor?.role, 40),
        action: normalizeText(input.action, 120) ?? "unknown",
        entityType: normalizeText(input.entityType, 80) ?? "unknown",
        entityId: normalizeText(input.entityId, 120),
        summary: normalizeText(input.summary, 500),
        ...(metadata ? { metadata } : {}),
      },
    });
  } catch (error) {
    console.error("AUDIT_LOG_WRITE_FAILED", error);
  }
}

export async function listAuditLogs({
  leagueId,
  limit,
  cursor,
  action,
  entityType,
}: ListAuditLogsInput) {
  const take = clampLimit(limit);
  const logs = await prisma.auditLog.findMany({
    where: {
      leagueId,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
    },
    take: take + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: {
      id: true,
      leagueId: true,
      actorUserId: true,
      actorUsername: true,
      actorRole: true,
      action: true,
      entityType: true,
      entityId: true,
      summary: true,
      metadata: true,
      createdAt: true,
    },
  });

  const hasMore = logs.length > take;
  const items = hasMore ? logs.slice(0, take) : logs;
  return {
    logs: items,
    nextCursor: hasMore ? items[items.length - 1]?.id ?? null : null,
  };
}


export async function getMatchTimeline(matchId: string, limit = 30) {
  const match = await prisma.match.findUnique({ where: { id: matchId }, select: { leagueId: true } });
  if (!match) return null;
  const logs = await prisma.auditLog.findMany({
    where: { leagueId: match.leagueId, entityType: "match", entityId: matchId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true, action: true, summary: true, actorUsername: true, actorRole: true, createdAt: true },
  });
  return { leagueId: match.leagueId, logs };
}
