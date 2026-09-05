// API Security Middleware
// Wraps API route handlers with rate limiting, input validation, and error handling.
// Usage: wrap your route handler with withSecurity(handler)

import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit } from "./rate-limiter";
import { withErrorBoundary, withErrorBoundaryAndParams } from "./error-boundary";

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
 * Extract user ID from Supabase session cookie.
 * Falls back to IP if no session is available.
 */
function getRateLimitKey(req: NextRequest): string {
  const clientIP = getClientIP(req);
  try {
    const sessionCookie = req.cookies.get("sb-access-token")?.value;
    if (sessionCookie) {
      // JWT payload is base64url-encoded second segment
      const parts = sessionCookie.split(".");
      if (parts.length === 3) {
        const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString());
        const userId = payload.sub;
        if (userId) return `api:user:${userId}:${req.nextUrl.pathname}`;
      }
    }
  } catch {
    // Fall through to IP-based key
  }
  return `api:ip:${clientIP}:${req.nextUrl.pathname}`;
}

/**
 * Security middleware wrapper for API route handlers.
 * Adds rate limiting, body size validation, security headers, and error handling.
 */
export function withSecurity(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: SecurityConfig = {}
) {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };

  return withErrorBoundary(async (req: NextRequest): Promise<NextResponse> => {
    // 1. Rate limiting — uses authenticated user ID when available, falls back to IP
    const rateKey = getRateLimitKey(req);
    const rateLimit = await checkRateLimit(rateKey, cfg.rateLimit);

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
  });
}

/**
 * Security middleware for API route handlers with dynamic params.
 * Wraps handlers that need access to route params.
 */
export function withSecurityAndParams<P extends Record<string, unknown>>(
  handler: (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse>,
  config: SecurityConfig = {}
) {
  const cfg = { ...DEFAULT_SECURITY_CONFIG, ...config };

  return withErrorBoundaryAndParams(async (req: NextRequest, context: { params: Promise<P> }): Promise<NextResponse> => {
    // 1. Rate limiting — uses authenticated user ID when available, falls back to IP
    const rateKey = getRateLimitKey(req);
    const rateLimit = await checkRateLimit(rateKey, cfg.rateLimit);

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
    const response = await handler(req, context);

    // 4. Add security headers to response
    response.headers.set("X-Content-Type-Options", "nosniff");
    response.headers.set("X-Frame-Options", "DENY");
    response.headers.set("X-RateLimit-Limit", String(cfg.rateLimit?.maxRequests));
    response.headers.set("X-RateLimit-Remaining", String(rateLimit.remaining));

    return response;
  });
}
