import type { FastifyReply, FastifyRequest } from "fastify";

type RateLimitConfig = {
  max: number;
  windowMs: number;
  keyPrefix: string;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const buckets = new Map<string, Bucket>();

function cleanupExpired(now: number) {
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

function getClientKey(request: FastifyRequest, suffix?: string) {
  const ip = request.ip || "unknown";
  return suffix ? `${ip}:${suffix}` : ip;
}

export function consumeRateLimit(config: RateLimitConfig, request: FastifyRequest, suffix?: string) {
  const now = Date.now();
  cleanupExpired(now);

  const key = `${config.keyPrefix}:${getClientKey(request, suffix)}`;
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const next = { count: 1, resetAt: now + config.windowMs };
    buckets.set(key, next);
    return {
      allowed: true as const,
      remaining: Math.max(0, config.max - next.count),
      retryAfterSeconds: Math.ceil(config.windowMs / 1000)
    };
  }

  if (existing.count >= config.max) {
    return {
      allowed: false as const,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
    };
  }

  existing.count += 1;
  return {
    allowed: true as const,
    remaining: Math.max(0, config.max - existing.count),
    retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000))
  };
}

export function enforceRateLimit(
  config: RateLimitConfig,
  request: FastifyRequest,
  reply: FastifyReply,
  options?: { suffix?: string; message?: string }
) {
  const result = consumeRateLimit(config, request, options?.suffix);
  reply.header("X-RateLimit-Limit", String(config.max));
  reply.header("X-RateLimit-Remaining", String(result.remaining));
  reply.header("Retry-After", String(result.retryAfterSeconds));

  if (result.allowed) {
    return true;
  }

  reply.status(429).send({
    error: options?.message ?? "Too many requests. Please try again shortly."
  });
  return false;
}
