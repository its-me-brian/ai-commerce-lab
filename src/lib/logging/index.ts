// Logging
// Simple structured logging for agent operations.

export enum LogLevel {
  DEBUG = "debug",
  INFO = "info",
  WARN = "warn",
  ERROR = "error",
}

interface LogEntry {
  level: LogLevel;
  message: string;
  context?: Record<string, unknown>;
  timestamp: Date;
}

class Logger {
  private entries: LogEntry[] = [];

  log(
    level: LogLevel,
    message: string,
    context?: Record<string, unknown>
  ): void {
    const entry: LogEntry = {
      level,
      message,
      context,
      timestamp: new Date(),
    };

    this.entries.push(entry);

    // Console output
    const prefix = `[${entry.timestamp.toISOString()}] [${level.toUpperCase()}]`;
    switch (level) {
      case LogLevel.ERROR:
        console.error(`${prefix} ${message}`, context || "");
        break;
      case LogLevel.WARN:
        console.warn(`${prefix} ${message}`, context || "");
        break;
      case LogLevel.DEBUG:
        console.debug(`${prefix} ${message}`, context || "");
        break;
      default:
        console.log(`${prefix} ${message}`, context || "");
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

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  getEntriesByLevel(level: LogLevel): LogEntry[] {
    return this.entries.filter((e) => e.level === level);
  }

  clear(): void {
    this.entries = [];
  }
}

export const logger = new Logger();
