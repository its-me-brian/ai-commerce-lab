// API Security Middleware
// Wraps API route handlers with rate limiting and input validation.
// Usage: wrap your route handler with withSecurity(handler)

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";

interface SecurityConfig {
  rateLimit?: {
    windowMs?: number;
    maxRequests?: number;
  };
  /** Max body size in bytes (default: 1MB) */
  maxBodySize?: number;
}

const DEFAULT_SECURITY_CONFIG: SecurityConfig = {
  rateLimit: {
    windowMs: 60_000,
    maxRequests: 60,
  },
  maxBodySize: 1024 * 1024, // 1MB
};

/**
 * Extract client IP from request headers.
 */
function getClientIP(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/**
 * Security middleware wrapper for API route handlers.
 * Adds rate limiting, body size validation, and security headers.
 */
export function withSecurity(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: SecurityConfig = {}
) {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };

  return async (req: NextRequest): Promise<NextResponse> => {
    const clientIP = getClientIP(req);

    // 1. Rate limiting
    const rateKey = `api:${clientIP}:${req.nextUrl.pathname}`;
    const rateLimit = checkRateLimit(rateKey, cfg.rateLimit);

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          success: false,
          error: "Rate limit exceeded. Try again later.",
          retryAfter: Math.ceil((rateLimit.resetAt - Date.now()) / 1000),
        },
        {
          status: 429,
          headers: {
            "X-RateLimit-Limit": String(cfg.rateLimit?.maxRequests),
            "X-RateLimit-Remaining": "0",
            "X-RateLimit-Reset": String(Math.ceil(rateLimit.resetAt / 1000)),
            "Retry-After": String(Math.ceil((rateLimit.resetAt - Date.now()) / 1000)),
          },
        }
      );
    }

    // 2. Body size validation (for non-GET/HEAD requests)
    if (req.method !== "GET" && req.method !== "HEAD") {
      const contentLength = req.headers.get("content-length");
      if (contentLength && parseInt(contentLength, 10) > cfg.maxBodySize!) {
        return NextResponse.json(
          {
            success: false,
            error: `Request body too large. Max size: ${cfg.maxBodySize! / 1024}KB`,
          },
          { status: 413 }
        );
      }
    }

    // 3. Call the actual handler
    const response = await handler(req);

    // 4. Add security headers to response
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-RateLimit-Limit", String(cfg.rateLimit?.maxRequests));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));

    return response;
  };
}
