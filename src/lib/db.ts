import { PrismaClient } from "@prisma/client";

let prisma: PrismaClient | null = null;

export function getDb() {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL
        }
      }
    });
  }

  return prisma;
}
