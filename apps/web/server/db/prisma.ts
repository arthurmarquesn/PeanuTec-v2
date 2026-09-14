import {
  PrismaBetterSqlite3,
} from "@prisma/adapter-better-sqlite3";

import {
  PrismaClient,
} from "@/generated/prisma/client";

const databaseUrl =
  process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL não está definida.",
  );
}

const adapter =
  new PrismaBetterSqlite3({
    url: databaseUrl,
  });

const globalForPrisma =
  globalThis as unknown as {
    prisma:
      | PrismaClient
      | undefined;
  };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  });

if (
  process.env.NODE_ENV !==
  "production"
) {
  globalForPrisma.prisma =
    prisma;
}