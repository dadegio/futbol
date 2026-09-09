import { prisma } from "@/lib/prisma";

export async function getApplicationHealth() {
  const startedAt = Date.now();
  await prisma.$queryRaw`SELECT 1`;
  return {
    status: "ok" as const,
    database: "ok" as const,
    latencyMs: Date.now() - startedAt,
    timestamp: new Date().toISOString(),
  };
}
