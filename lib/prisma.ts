import "server-only";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const connectionString = process.env.DATABASE_URL ?? process.env.DIRECT_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL o DIRECT_URL non impostata");
}

const schema = (() => {
  const explicit = process.env.DATABASE_SCHEMA?.trim();
  if (explicit) return explicit;

  try {
    return new URL(connectionString).searchParams.get("schema")?.trim() || undefined;
  } catch {
    return undefined;
  }
})();

const adapter = schema
  ? new PrismaPg({ connectionString }, { schema })
  : new PrismaPg({ connectionString });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}