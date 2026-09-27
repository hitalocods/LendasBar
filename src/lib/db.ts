import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

/**
 * Constrói a URL de conexão com o banco de dados de forma segura usando a API URL
 * para evitar malformação em URLs que já contêm query params, fragmentos ou caracteres especiais.
 */
function buildConnectionUrl(rawUrl: string | undefined): string | undefined {
  if (!rawUrl) return undefined;

  try {
    const url = new URL(rawUrl);

    // Só adiciona os params de pool se ainda não estiverem definidos
    if (!url.searchParams.has("connection_limit")) {
      url.searchParams.set("connection_limit", "15");
    }
    if (!url.searchParams.has("pool_timeout")) {
      url.searchParams.set("pool_timeout", "15");
    }

    return url.toString();
  } catch {
    // URL inválida — retorna como está e deixa o Prisma dar o erro descritivo
    return rawUrl;
  }
}

export function getDb() {
  if (!globalForPrisma.prisma) {
    const rawUrl = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL;
    const url = buildConnectionUrl(rawUrl);

    globalForPrisma.prisma = new PrismaClient({
      datasources: {
        db: { url }
      }
    });
  }

  return globalForPrisma.prisma;
}
