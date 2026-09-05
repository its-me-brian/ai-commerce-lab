// Security Middleware
// Input validation, prompt injection detection, and audit logging.
//
// Sits between user input and AI execution:
//   1. InputValidator — validates input length, type, required fields
//   2. PromptInjectionDetector — detects common prompt injection patterns
//   3. SecurityAudit — logs security events for monitoring
//
// This COMPLEMENTS existing sanitize.ts (XSS) and rate-limiter.ts (throttling).
// This is NOT a replacement — it adds the AI-specific security layer.

import { logger } from "../logging";

// ============================================
// INPUT VALIDATOR
// ============================================

/**
 * Validation rule for a single field.
 */
export interface FieldRule {
  /** Field name */
  name: string;

  /** Whether the field is required */
  required?: boolean;

  /** Minimum string length */
  minLength?: number;

  /** Maximum string length */
  maxLength?: number;

  /** Minimum numeric value */
  min?: number;

  /** Maximum numeric value */
  max?: number;

  /** Allowed values (enum) */
  allowedValues?: unknown[];

  /** Custom validator function */
  validate?: (value: unknown) => boolean;

  /** Error message if validation fails */
  message?: string;
}

/**
 * Validation result.
 */
export interface ValidationResult {
  /** Whether all validations passed */
  valid: boolean;

  /** Field-level errors */
  errors: Array<{
    field: string;
    message: string;
    value: unknown;
  }>;
}

/**
 * Validate input against a set of field rules.
 */
export function validateInput(
  data: Record<string, unknown>,
  rules: FieldRule[]
): ValidationResult {
  const errors: ValidationResult["errors"] = [];

  for (const rule of rules) {
    const value = data[rule.name];

    // Required check
    if (rule.required && (value === undefined || value === null || value === "")) {
      errors.push({
        field: rule.name,
        message: rule.message ?? `${rule.name} is required`,
        value,
      });
      continue;
    }

    // Skip further checks if not present
    if (value === undefined || value === null) continue;

    // String length
    if (typeof value === "string") {
      if (rule.minLength !== undefined && value.length < rule.minLength) {
        errors.push({
          field: rule.name,
          message: rule.message ?? `${rule.name} must be at least ${rule.minLength} characters`,
          value,
        });
      }
      if (rule.maxLength !== undefined && value.length > rule.maxLength) {
        errors.push({
          field: rule.name,
          message: rule.message ?? `${rule.name} must be at most ${rule.maxLength} characters`,
          value,
        });
      }
    }

    // Numeric range
    if (typeof value === "number") {
      if (rule.min !== undefined && value < rule.min) {
        errors.push({
          field: rule.name,
          message: rule.message ?? `${rule.name} must be at least ${rule.min}`,
          value,
        });
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push({
          field: rule.name,
          message: rule.message ?? `${rule.name} must be at most ${rule.max}`,
          value,
        });
      }
    }

    // Allowed values
    if (rule.allowedValues && !rule.allowedValues.includes(value)) {
      errors.push({
        field: rule.name,
        message: rule.message ?? `${rule.name} must be one of: ${rule.allowedValues.join(", ")}`,
        value,
      });
    }

    // Custom validator
    if (rule.validate && !rule.validate(value)) {
      errors.push({
        field: rule.name,
        message: rule.message ?? `${rule.name} failed custom validation`,
        value,
      });
    }
  }

  return { valid: errors.length === 0, errors };
}

// ============================================
// PROMPT INJECTION DETECTOR
// ============================================

/**
 * Detection result.
 */
export interface InjectionCheckResult {
  /** Whether injection was detected */
  detected: boolean;

  /** Pattern that matched (if any) */
  matchedPattern?: string;

  /** Risk level */
  riskLevel: "none" | "low" | "medium" | "high";

  /** The original input */
  input: string;
}

/**
 * Known prompt injection patterns (ordered by severity).
 * These are common patterns that attempt to override AI instructions.
 */
const INJECTION_PATTERNS: Array<{
  pattern: RegExp;
  riskLevel: InjectionCheckResult["riskLevel"];
  description: string;
}> = [
  // High risk: direct instruction override attempts
  { pattern: /ignore\s+(all\s+)?(previous|prior|above|earlier)\s+(instructions?|prompts?|rules?)/i, riskLevel: "high", description: "instruction override" },
  { pattern: /disregard\s+(all\s+)?(previous|prior|above)\s+(instructions?|prompts?)/i, riskLevel: "high", description: "instruction disregard" },
  { pattern: /you\s+are\s+now\s+(a|an|the)\s+/i, riskLevel: "high", description: "role reassignment" },
  { pattern: /act\s+as\s+if\s+you\s+(have\s+)?no\s+(rules?|restrictions?|limits?)/i, riskLevel: "high", description: "restriction bypass" },
  { pattern: /forget\s+(all\s+)?(your|previous|prior)\s+(instructions?|rules?|prompts?)/i, riskLevel: "high", description: "memory wipe attempt" },
  { pattern: /new\s+(instructions?|system\s*prompt|role)\s*:/i, riskLevel: "high", description: "system prompt injection" },

  // Medium risk: indirect manipulation
  { pattern: /\[INST\]|\[\/INST\]/i, riskLevel: "medium", description: "LLM bracket syntax" },
  { pattern: /<\|im_start\|>|<\|im_end\|>/i, riskLevel: "medium", description: "ChatML injection" },
  { pattern: /Human:|Assistant:|System:/i, riskLevel: "medium", description: "role label injection" },
  { pattern: /###\s*(System|Human|Assistant)\s*:/i, riskLevel: "medium", description: "markdown role injection" },
  { pattern: /ADMIN OVERRIDE|DEBUG MODE|DEVELOPER MODE/i, riskLevel: "medium", description: "privilege escalation" },

  // Low risk: suspicious but potentially legitimate
  { pattern: /repeat\s+(after\s+me|the\s+following)/i, riskLevel: "low", description: "repetition request" },
  { pattern: /what\s+(are|is)\s+your\s+(system\s*)?prompt/i, riskLevel: "low", description: "prompt extraction" },
  { pattern: /translate\s+(this|the\s+following)\s+(to|into)\s+/i, riskLevel: "low", description: "translation request" },
];

/**
 * Check input for prompt injection patterns.
 */
export function detectPromptInjection(input: string): InjectionCheckResult {
  for (const { pattern, riskLevel, description } of INJECTION_PATTERNS) {
    if (pattern.test(input)) {
      return {
        detected: true,
        matchedPattern: description,
        riskLevel,
        input,
      };
    }
  }

  return {
    detected: false,
    riskLevel: "none",
    input,
  };
}

/**
 * Check multiple inputs for injection.
 * Returns all detections, sorted by risk level.
 */
export function detectPromptInjectionBatch(
  inputs: Array<{ name: string; value: string }>
): Array<{ name: string; result: InjectionCheckResult }> {
  return inputs
    .map(({ name, value }) => ({
      name,
      result: detectPromptInjection(value),
    }))
    .filter((r) => r.result.detected);
}

// ============================================
// SECURITY AUDIT
// ============================================

/**
 * Security event types.
 */
export type SecurityEventType =
  | "sanitization_applied"
  | "injection_detected"
  | "rate_limit_hit"
  | "validation_failed"
  | "size_limit_exceeded"
  | "unauthorized_access"
  | "suspicious_input";

/**
 * Security audit log entry.
 */
export interface SecurityAuditEntry {
  /** Unique ID */
  id: string;

  /** Event type */
  eventType: SecurityEventType;

  /** Severity */
  severity: "low" | "medium" | "high" | "critical";

  /** Human-readable message */
  message: string;

  /** Source component */
  source: string;

  /** Client identifier (IP, user ID, etc.) */
  clientId?: string;

  /** Input that triggered the event (sanitized) */
  sanitizedInput?: string;

  /** Additional metadata */
  metadata?: Record<string, unknown>;

  /** Timestamp */
  timestamp: number;

  /** Workspace ID for multi-tenant isolation */
  workspaceId?: string;
}

/**
 * Security Audit — logs security events for monitoring.
 * Persistence: Events are persisted to Supabase (security_audit_logs table)
 * for survival across restarts. In-memory array is kept as read cache.
 */
export class SecurityAudit {
  private entries: SecurityAuditEntry[] = [];
  private readonly maxEntries: number;
  private idCounter = 0;

  constructor(maxEntries: number = 2_000) {
    this.maxEntries = maxEntries;
  }

  /**
   * Log a security event.
   */
  log(entry: Omit<SecurityAuditEntry, "id" | "timestamp">): SecurityAuditEntry {
    const full: SecurityAuditEntry = {
      ...entry,
      id: `sec-${++this.idCounter}`,
      timestamp: Date.now(),
    };

    this.entries.push(full);
    if (this.entries.length > this.maxEntries) {
      this.entries = this.entries.slice(-this.maxEntries);
    }

    // Console warning for high/critical
    if (entry.severity === "high" || entry.severity === "critical") {
      logger.warn(`[SECURITY] ${entry.severity.toUpperCase()}: ${entry.message}`, {
        source: entry.source,
        clientId: entry.clientId,
      });
    }

    // Persist to Supabase (fire-and-forget)
    this.persistToSupabase(full);

    return full;
  }

  /**
   * Persist a security event to Supabase.
   */
  private async persistToSupabase(entry: SecurityAuditEntry): Promise<void> {
    try {
      const { supabase } = await import("@/lib/database/supabase");

      await supabase.from("security_audit_logs").insert({
        event_type: entry.eventType,
        severity: entry.severity,
        message: entry.message,
        source: entry.source,
        client_id: entry.clientId ?? null,
        sanitized_input: entry.sanitizedInput ?? null,
        metadata: entry.metadata ?? null,
        workspace_id: entry.workspaceId ?? null,
      });
    } catch {
      // Silent fail — in-memory is source of truth, DB is backup
    }
  }

  /**
   * Log sanitization applied.
   */
  sanitizationApplied(source: string, original: string, clientId?: string, workspaceId?: string): SecurityAuditEntry {
    return this.log({
      eventType: "sanitization_applied",
      severity: "low",
      message: `Input sanitized by ${source}`,
      source,
      clientId,
      sanitizedInput: original.slice(0, 200),
      workspaceId,
    });
  }

  /**
   * Log injection detection.
   */
  injectionDetected(
    source: string,
    input: string,
    riskLevel: "low" | "medium" | "high",
    clientId?: string,
    workspaceId?: string
  ): SecurityAuditEntry {
    return this.log({
      eventType: "injection_detected",
      severity: riskLevel === "high" ? "critical" : riskLevel === "medium" ? "high" : "medium",
      message: `Prompt injection detected (${riskLevel} risk)`,
      source,
      clientId,
      sanitizedInput: input.slice(0, 200),
      workspaceId,
    });
  }

  /**
   * Log rate limit hit.
   */
  rateLimitHit(source: string, clientId: string, workspaceId?: string): SecurityAuditEntry {
    return this.log({
      eventType: "rate_limit_hit",
      severity: "medium",
      message: `Rate limit exceeded for ${clientId}`,
      source,
      clientId,
      workspaceId,
    });
  }

  /**
   * Log validation failure.
   */
  validationFailed(source: string, field: string, clientId?: string, workspaceId?: string): SecurityAuditEntry {
    return this.log({
      eventType: "validation_failed",
      severity: "low",
      message: `Validation failed for field: ${field}`,
      source,
      clientId,
      workspaceId,
    });
  }

  /**
   * Get recent security events.
   */
  getRecent(count: number = 50): SecurityAuditEntry[] {
    return this.entries.slice(-count);
  }

  /**
   * Get events by type.
   */
  getByType(eventType: SecurityEventType): SecurityAuditEntry[] {
    return this.entries.filter((e) => e.eventType === eventType);
  }

  /**
   * Get events by severity.
   */
  getBySeverity(severity: SecurityAuditEntry["severity"]): SecurityAuditEntry[] {
    return this.entries.filter((e) => e.severity === severity);
  }

  /**
   * Get events by client.
   */
  getByClient(clientId: string): SecurityAuditEntry[] {
    return this.entries.filter((e) => e.clientId === clientId);
  }

  /**
   * Get summary stats.
   */
  getStats(): Record<SecurityEventType, number> {
    const stats: Record<string, number> = {};
    for (const entry of this.entries) {
      stats[entry.eventType] = (stats[entry.eventType] ?? 0) + 1;
    }
    return stats as Record<SecurityEventType, number>;
  }

  /**
   * Clear all entries.
   */
  clear(): void {
    this.entries = [];
  }
}

// ============================================
// SINGLETONS
// ============================================

let auditInstance: SecurityAudit | null = null;

export function getSecurityAudit(): SecurityAudit {
  if (!auditInstance) auditInstance = new SecurityAudit();
  return auditInstance;
}

export function resetSecurityAudit(): void {
  auditInstance = null;
}
