/**
 * Rate Limiter In-Memory simples para rotas públicas (Proteção contra Flood/DDoS em QR Codes)
 */

type RateLimitRecord = {
  count: number;
  resetAt: number;
};

const globalForRateLimit = globalThis as unknown as {
  rateLimitStore?: Map<string, RateLimitRecord>;
};

const memoryStore = globalForRateLimit.rateLimitStore ?? new Map<string, RateLimitRecord>();
if (process.env.NODE_ENV !== "production") {
  globalForRateLimit.rateLimitStore = memoryStore;
}

/**
 * Limpa periodicamente registros expirados para evitar vazamento de memória
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, record] of memoryStore.entries()) {
    if (now > record.resetAt) {
      memoryStore.delete(key);
    }
  }
}, 30_000);

export function checkRateLimit(
  identifier: string,
  limit: number = 15,
  windowMs: number = 10_000
): { allowed: boolean; remaining: number; resetMs: number } {
  const now = Date.now();
  const record = memoryStore.get(identifier);

  if (!record || now > record.resetAt) {
    memoryStore.set(identifier, {
      count: 1,
      resetAt: now + windowMs
    });
    return { allowed: true, remaining: limit - 1, resetMs: windowMs };
  }

  if (record.count >= limit) {
    return { allowed: false, remaining: 0, resetMs: record.resetAt - now };
  }

  record.count += 1;
  return { allowed: true, remaining: limit - record.count, resetMs: record.resetAt - now };
}
