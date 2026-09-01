import { NextRequest, NextResponse } from "next/server";

// In-memory rate limiter (lightweight, no external deps)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(key: string, maxRequests: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = rateLimitStore.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= maxRequests) return false;

  entry.count++;
  return true;
}

// Cleanup stale entries periodically
const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore) {
    if (now > entry.resetAt) rateLimitStore.delete(key);
  }
}, 5 * 60 * 1000);

// Prevent the interval from keeping the process alive
if (typeof clearInterval === "function") {
  // Node.js — unref the interval
  try { (cleanupInterval as ReturnType<typeof setInterval>); } catch { /* browser env */ }
}

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip") ||
    "unknown"
  );
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // === Security Headers ===
  const response = NextResponse.next();

  // Prevent MIME sniffing
  response.headers.set("X-Content-Type-Options", "nosniff");
  // Clickjacking protection
  response.headers.set("X-Frame-Options", "DENY");
  // XSS filter (legacy browsers)
  response.headers.set("X-XSS-Protection", "1; mode=block");
  // Referrer policy
  response.headers.set("Referrer-Policy", "strict-origin-when-cross-origin");
  // Permissions policy — disable camera, mic, geolocation
  response.headers.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");

  // === Rate Limiting for API routes ===
  if (pathname.startsWith("/api/")) {
    const clientIp = getClientIp(request);
    const rateLimitKey = `api:${clientIp}`;
    const isTestEndpoint = pathname.includes("/providers/test");

    // Stricter limits for expensive endpoints
    const maxRequests = isTestEndpoint ? 10 : 120;
    const windowMs = 60_000; // 1 minute

    if (!checkRateLimit(rateLimitKey, maxRequests, windowMs)) {
      return NextResponse.json(
        { success: false, error: "Too many requests. Please try again later." },
        { status: 429 }
      );
    }
  }

  // === Block suspicious paths ===
  const blockedPatterns = [
    /\.env/i,
    /\.git/i,
    /wp-admin/i,
    /phpmyadmin/i,
    /\.well-known/i,
  ];

  for (const pattern of blockedPatterns) {
    if (pattern.test(pathname)) {
      return new NextResponse("Not Found", { status: 404 });
    }
  }

  return response;
}

export const config = {
  matcher: [
    // Match all paths except static files and Next.js internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
};
