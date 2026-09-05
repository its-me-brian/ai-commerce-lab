// API Error Boundary
// Standardized error handling for API routes.
// Captures unhandled errors and returns consistent error responses.

import { NextRequest, NextResponse } from "next/server";
import { logger } from "../logging";

interface ErrorResponse {
  success: false;
  error: string;
  code?: string;
  requestId?: string;
}

/**
 * Generate a unique request ID for tracing.
 */
function generateRequestId(): string {
  return `req_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Sanitize error message for client response.
 * Removes internal details like file paths, stack traces, etc.
 */
function sanitizeErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    // Only return generic message for known error types
    if (error.name === "ValidationError") {
      return "Validation failed";
    }
    if (error.name === "UnauthorizedError") {
      return "Unauthorized";
    }
    if (error.name === "ForbiddenError") {
      return "Forbidden";
    }
    // For other errors, return generic message
    return "Internal server error";
  }
  return "Internal server error";
}

/**
 * Get HTTP status code from error type.
 */
function getStatusCode(error: unknown): number {
  if (error instanceof Error) {
    if (error.name === "ValidationError") return 400;
    if (error.name === "UnauthorizedError") return 401;
    if (error.name === "ForbiddenError") return 403;
    if (error.name === "NotFoundError") return 404;
    if (error.name === "RateLimitError") return 429;
  }
  return 500;
}

/**
 * Error boundary wrapper for API route handlers.
 * Catches unhandled errors and returns consistent error responses.
 */
export function withErrorBoundary(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      return await handler(req);
    } catch (error) {
      // Log error internally (not exposed to client)
      logger.error(`[API Error] ${requestId}`, {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      const statusCode = getStatusCode(error);
      const errorMessage = sanitizeErrorMessage(error);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          requestId,
        } as ErrorResponse,
        {
          status: statusCode,
          headers: {
            "X-Request-Id": requestId,
          },
        }
      );
    }
  };
}

/**
 * Error boundary wrapper for API route handlers with params.
 */
export function withErrorBoundaryAndParams<P extends Record<string, unknown>>(
  handler: (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse>
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<NextResponse> => {
    const requestId = generateRequestId();

    try {
      return await handler(req, context);
    } catch (error) {
      // Log error internally (not exposed to client)
      logger.error(`[API Error] ${requestId}`, {
        path: req.nextUrl.pathname,
        method: req.method,
        error: error instanceof Error ? error.message : "Unknown error",
        stack: error instanceof Error ? error.stack : undefined,
      });

      const statusCode = getStatusCode(error);
      const errorMessage = sanitizeErrorMessage(error);

      return NextResponse.json(
        {
          success: false,
          error: errorMessage,
          code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
          requestId,
        } as ErrorResponse,
        {
          status: statusCode,
          headers: {
            "X-Request-Id": requestId,
          },
        }
      );
    }
  };
}