// Validator Mini-AI
// Checks format, coherence, rules compliance.
// Deterministic: schema validation. LLM: semantic validation.

import { z } from "zod";
import type { MiniAIDefinition } from "../types";

// F10: Zod schemas for runtime validation
export const ValidatorInputSchema = z.object({
  data: z.record(z.unknown()),
  rules: z.array(z.string()).min(1, "at least one rule required"),
  strictMode: z.boolean().optional(),
});

export const ValidatorOutputSchema = z.object({
  valid: z.boolean(),
  violations: z.array(z.object({
    rule: z.string(),
    severity: z.string(),
    message: z.string(),
    field: z.string(),
  })),
  score: z.number().min(0).max(1),
  checkedRules: z.number(),
  passedRules: z.number(),
});

export const validatorDefinition: MiniAIDefinition = {
  id: "validator",
  name: "Validator",
  description: "Validates data against format rules, schema, and business constraints",
  category: "validation",
  type: "validator",
  executionMode: "hybrid",
  instructions: `You are a validation specialist. Given data and validation rules:
1. Check each rule against the data
2. Identify violations
3. Assign severity (info/warning/error/critical)
4. Return structured validation result

Output format:
{
  "valid": boolean,
  "violations": [{ "rule": "string", "severity": "string", "message": "string", "field": "string" }],
  "score": 0.0-1.0,
  "checkedRules": number,
  "passedRules": number
}`,
  inputSchema: ValidatorInputSchema,
  outputSchema: ValidatorOutputSchema,
  modelRequirements: {
    complexity: "simple",
    responseFormat: "json",
    minContextWindow: 4000,
  },
  defaultTemperature: 0.1,
  maxOutputTokens: 2048,
  enabled: true,
  version: "1.0.0",
  tags: ["validation", "rules", "compliance", "quality"],
  timeoutMs: 15000,
};

/**
 * Deterministic implementation — rule-based validation.
 */
export async function validatorDeterministic(input: Record<string, unknown>) {
  const data = (typeof input.data === "object" && input.data !== null) ? input.data as Record<string, unknown> : {};
  const rules = Array.isArray(input.rules) ? input.rules : [];
  const strictMode = Boolean(input.strictMode);

  const violations: Array<{ rule: string; severity: string; message: string; field: string }> = [];

  for (const rule of rules) {
    const ruleLower = rule.toLowerCase();

    // Required fields check
    if (ruleLower.includes("required")) {
      const fieldMatch = ruleLower.match(/required[:\s]+(\w+)/);
      if (fieldMatch) {
        const field = fieldMatch[1];
        if (!data[field] && data[field] !== 0 && data[field] !== false) {
          violations.push({
            rule,
            severity: "error",
            message: `Missing required field: ${field}`,
            field,
          });
        }
      }
    }

    // Type checks
    if (ruleLower.includes("type")) {
      const typeMatch = ruleLower.match(/(\w+)\s+(?:must be|should be|is)\s+(string|number|boolean|array|object)/);
      if (typeMatch) {
        const [, field, expectedType] = typeMatch;
        if (data[field] !== undefined) {
          const actualType = Array.isArray(data[field]) ? "array" : typeof data[field];
          if (actualType !== expectedType) {
            violations.push({
              rule,
              severity: "warning",
              message: `Field ${field} should be ${expectedType}, got ${actualType}`,
              field,
            });
          }
        }
      }
    }

    // Range checks
    if (ruleLower.includes("range") || ruleLower.includes("min") || ruleLower.includes("max")) {
      const rangeMatch = ruleLower.match(/(\w+)\s+(?:must be|should be)\s+(?:between\s+)?(\d+\.?\d*)\s*(?:and|to|-)\s*(\d+\.?\d*)/);
      if (rangeMatch) {
        const [, field, min, max] = rangeMatch;
        const value = Number(data[field]);
        if (!isNaN(value)) {
          if (value < Number(min) || value > Number(max)) {
            violations.push({
              rule,
              severity: "warning",
              message: `Field ${field} value ${value} is outside range [${min}, ${max}]`,
              field,
            });
          }
        }
      }
    }

    // Format checks
    if (ruleLower.includes("format") || ruleLower.includes("pattern")) {
      if (ruleLower.includes("email") && data.email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(String(data.email))) {
          violations.push({
            rule,
            severity: "error",
            message: "Invalid email format",
            field: "email",
          });
        }
      }
      if (ruleLower.includes("url") && data.url) {
        try {
          new URL(String(data.url));
        } catch {
          violations.push({
            rule,
            severity: "error",
            message: "Invalid URL format",
            field: "url",
          });
        }
      }
    }

    // Non-empty checks
    if (ruleLower.includes("non-empty") || ruleLower.includes("not empty")) {
      const fieldMatch = ruleLower.match(/(\w+)\s+(?:must be|should be)\s+non-empty/);
      if (fieldMatch) {
        const field = fieldMatch[1];
        const value = data[field];
        if (value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0)) {
          violations.push({
            rule,
            severity: "error",
            message: `Field ${field} must not be empty`,
            field,
          });
        }
      }
    }
  }

  const checkedRules = rules.length;
  const passedRules = checkedRules - violations.length;
  const score = checkedRules > 0 ? passedRules / checkedRules : 1;
  const hasCritical = violations.some((v) => v.severity === "critical");
  const hasErrors = violations.some((v) => v.severity === "error");
  const valid = strictMode ? violations.length === 0 : !hasCritical && !hasErrors;

  return {
    output: {
      valid,
      violations,
      score,
      checkedRules,
      passedRules,
    },
    confidence: 0.8,
    reasoning: `Checked ${checkedRules} rules, found ${violations.length} violations`,
  };
}
