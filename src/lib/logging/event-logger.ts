// Event Logger
// FASE 40: Centralized event logging utility.

const LOG_ENDPOINT = "/api/events";

export type EventSeverity = "debug" | "info" | "warning" | "error" | "critical";

interface LogEventInput {
  eventType: string;
  severity?: EventSeverity;
  source?: string;
  agentId?: string;
  message: string;
  metadata?: Record<string, unknown>;
}

/**
 * Log an event to the centralized event store.
 * Fire-and-forget: errors are caught and logged to console only.
 */
export async function logEvent(input: LogEventInput): Promise<void> {
  try {
    await fetch(LOG_ENDPOINT, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        eventType: input.eventType,
        severity: input.severity || "info",
        source: input.source || null,
        agentId: input.agentId || null,
        message: input.message,
        metadata: input.metadata || {},
      }),
    });
  } catch (err) {
    // Don't let logging failures break the app
    console.error("[EventLogger] Failed to log event:", err);
  }
}

// Convenience helpers
export const logger = {
  debug: (eventType: string, message: string, meta?: Record<string, unknown>) =>
    logEvent({ eventType, severity: "debug", message, metadata: meta }),
  info: (eventType: string, message: string, meta?: Record<string, unknown>) =>
    logEvent({ eventType, severity: "info", message, metadata: meta }),
  warn: (eventType: string, message: string, meta?: Record<string, unknown>) =>
    logEvent({ eventType, severity: "warning", message, metadata: meta }),
  error: (eventType: string, message: string, meta?: Record<string, unknown>) =>
    logEvent({ eventType, severity: "error", message, metadata: meta }),
  critical: (eventType: string, message: string, meta?: Record<string, unknown>) =>
    logEvent({ eventType, severity: "critical", message, metadata: meta }),
};
