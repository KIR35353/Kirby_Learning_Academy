import { RateLimiterRedis } from "rate-limiter-flexible";
import Redis from "ioredis";
import { NextRequest, NextResponse } from "next/server";

// ── Redis client for rate limiting ─────────────────────────────────────────
// Separate from BullMQ connection — uses ioredis instance directly
let _redisClient: Redis | null = null;

function getRedisClient(): Redis {
  if (!_redisClient) {
    const url = process.env.REDIS_URL ?? "redis://localhost:6379";
    _redisClient = new Redis(url, { enableOfflineQueue: false, lazyConnect: true });
    _redisClient.on("error", () => {
      // Redis unavailable — rate limiting degrades gracefully (see fallback below)
    });
  }
  return _redisClient;
}

// ── Limiter definitions ────────────────────────────────────────────────────
let _authLimiter: RateLimiterRedis | null = null;
let _apiLimiter: RateLimiterRedis | null = null;
let _uploadLimiter: RateLimiterRedis | null = null;

function getAuthLimiter() {
  if (!_authLimiter) {
    _authLimiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: "rl_auth",
      points: 10,         // max 10 attempts
      duration: 900,      // per 15 minutes
      blockDuration: 900, // block for 15 minutes after limit hit
    });
  }
  return _authLimiter;
}

function getApiLimiter() {
  if (!_apiLimiter) {
    _apiLimiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: "rl_api",
      points: 120,   // 120 requests
      duration: 60,  // per minute
    });
  }
  return _apiLimiter;
}

function getUploadLimiter() {
  if (!_uploadLimiter) {
    _uploadLimiter = new RateLimiterRedis({
      storeClient: getRedisClient(),
      keyPrefix: "rl_upload",
      points: 20,      // 20 uploads
      duration: 3600,  // per hour
    });
  }
  return _uploadLimiter;
}

// ── IP extraction ──────────────────────────────────────────────────────────
function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

// ── Public helpers ─────────────────────────────────────────────────────────

/**
 * Apply rate limiting. Returns a 429 Response if over limit, or null if allowed.
 * Gracefully degrades (allows through) if Redis is unavailable.
 */
export async function rateLimit(
  req: NextRequest,
  type: "auth" | "api" | "upload" = "api"
): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const limiter = type === "auth" ? getAuthLimiter() : type === "upload" ? getUploadLimiter() : getApiLimiter();

  try {
    await limiter.consume(ip);
    return null; // allowed
  } catch (err: unknown) {
    // RateLimiterRes thrown when over limit
    if (err && typeof err === "object" && "msBeforeNext" in err) {
      const ms = (err as { msBeforeNext: number }).msBeforeNext;
      return NextResponse.json(
        { error: "Too many requests", retryAfter: Math.ceil(ms / 1000) },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(ms / 1000)),
            "X-RateLimit-Reset": String(Math.ceil(Date.now() / 1000) + Math.ceil(ms / 1000)),
          },
        }
      );
    }
    // Redis unavailable — fail open (allow request through)
    return null;
  }
}

/**
 * Stricter rate limit for auth endpoints.
 * Keyed by IP + email to prevent targeted brute-force.
 */
export async function rateLimitAuth(req: NextRequest, email?: string): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  const key = email ? `${ip}_${email.toLowerCase()}` : ip;
  const limiter = getAuthLimiter();

  try {
    await limiter.consume(key);
    return null;
  } catch (err: unknown) {
    if (err && typeof err === "object" && "msBeforeNext" in err) {
      const ms = (err as { msBeforeNext: number }).msBeforeNext;
      return NextResponse.json(
        { error: "Too many login attempts. Please try again later.", retryAfter: Math.ceil(ms / 1000) },
        { status: 429, headers: { "Retry-After": String(Math.ceil(ms / 1000)) } }
      );
    }
    return null; // Redis unavailable — fail open
  }
}
