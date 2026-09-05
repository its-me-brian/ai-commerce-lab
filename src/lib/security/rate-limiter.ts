// Rate Limiter with Supabase persistence
// FASE 43: Sliding-window rate limiter for API routes with database-backed storage.

import { logger } from "../logging";
import { supabase } from "@/lib/database/supabase";

export interface RateLimitConfig {
  windowMs: number;   // time window in milliseconds
  maxRequests: number; // max requests per window
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: 60_000,    // 1 minute
  maxRequests: 60,     // 60 req/min
};

/**
 * Check if a request is allowed under the rate limit.
 * Uses Supabase for persistence across server restarts and instances.
 * Returns { allowed, remaining, resetAt }.
 */
export async function checkRateLimit(
  key: string,
  config: Partial<RateLimitConfig> = {},
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const { windowMs, maxRequests } = { ...DEFAULT_CONFIG, ...config };
  const now = Date.now();
  const windowStart = now - windowMs;

  try {
    // Clean up old entries (older than window)
    await supabase
      .from("rate_limits")
      .delete()
      .lt("created_at", new Date(windowStart).toISOString());

    // Get current count for this key
    const { data, error } = await supabase
      .from("rate_limits")
      .select("id")
      .eq("key", key)
      .gte("created_at", new Date(windowStart).toISOString());

    if (error) {
      // Fail CLOSED — block request when backend is down to prevent abuse
      logger.warn("[RateLimiter] Database error, failing closed:", { error: error.message });
      return { allowed: false, remaining: 0, resetAt: now + windowMs };
    }

    const currentCount = data?.length || 0;

    if (currentCount >= maxRequests) {
 
      const _resetAt = new Date(now + windowMs).toISOString();
      return { allowed: false, remaining: 0, resetAt: now + windowMs };
    }

    // Record this request
    const { error: insertError } = await supabase
      .from("rate_limits")
      .insert({ key, created_at: new Date(now).toISOString() });

    if (insertError) {
      logger.warn("[RateLimiter] Insert error:", { error: insertError.message });
    }

    return { allowed: true, remaining: maxRequests - currentCount - 1, resetAt: now + windowMs };
  } catch (err) {
    // Fail CLOSED — block request on unexpected errors to prevent abuse
    logger.warn("[RateLimiter] Unexpected error, failing closed:", { error: String(err) });
    return { allowed: false, remaining: 0, resetAt: now + windowMs };
  }
}

/**
 * Get client IP from request headers.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}
