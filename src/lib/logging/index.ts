// Structured Logging
// Production-safe logging with level filtering and context sanitization.

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

// Level priority (lower = more verbose)
const LEVEL_PRIORITY: Record<LogLevel, number> = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

// Sensitive keys to redact from context
const SENSITIVE_KEYS = new Set([
  "password", "secret", "token", "api_key", "apiKey",
  "authorization", "cookie", "session", "credential",
]);

/**
 * Sanitize context object by redacting sensitive values.
 */
function sanitizeContext(context?: Record<string, unknown>): Record<string, unknown> | undefined {
  if (!context) return undefined;

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(context)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      sanitized[key] = "[REDACTED]";
    } else if (typeof value === "string" && value.length > 100) {
      // Truncate long strings
      sanitized[key] = `${value.substring(0, 100)}...`;
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private minLevel: LogLevel;

  constructor() {
    // In production, only log WARN and ERROR
    // In development, log everything
    const env = process.env.NODE_ENV || "development";
    this.minLevel = env === "production" ? LogLevel.WARN : LogLevel.DEBUG;
  }

  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    // Check level filter
    if (LEVEL_PRIORITY[level] < LEVEL_PRIORITY[this.minLevel]) {
      return;
    }

    const timestamp = new Date().toISOString();
    const sanitized = sanitizeContext(context);

    // Structured JSON output for production
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      ...(sanitized && Object.keys(sanitized).length > 0 && { context: sanitized }),
    };

    // Use appropriate console method
    const output = JSON.stringify(logEntry);
    switch (level) {
      case LogLevel.ERROR:
        console.error(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      default:
        console.log(output);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.INFO, message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.WARN, message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log(LogLevel.ERROR, message, context);
  }

  /**
   * Create a child logger with prefixed context.
   */
  child(prefix: string): ChildLogger {
    return new ChildLogger(this, prefix);
  }
}

class ChildLogger {
  constructor(
    private parent: Logger,
    private prefix: string
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    this.parent.debug(`${this.prefix} ${message}`, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.parent.info(`${this.prefix} ${message}`, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.parent.warn(`${this.prefix} ${message}`, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.parent.error(`${this.prefix} ${message}`, context);
  }
}

// Singleton logger instance
export const logger = new Logger();
