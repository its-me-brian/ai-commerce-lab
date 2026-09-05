// Environment Variable Validation
// Centralized validation for required environment variables.
// Call validateEnv() at app startup to catch missing vars early.

import { logger } from "./logging";

interface EnvVar {
  name: string;
  required: boolean;
  description: string;
}

const ENV_VARS: EnvVar[] = [
  // Supabase
  { name: "NEXT_PUBLIC_SUPABASE_URL", required: true, description: "Supabase project URL" },
  { name: "NEXT_PUBLIC_SUPABASE_ANON_KEY", required: true, description: "Supabase anonymous key" },
  { name: "SUPABASE_URL", required: true, description: "Supabase URL for server-side ops" },
  { name: "SUPABASE_SERVICE_ROLE_KEY", required: true, description: "Supabase service role key" },

  // Security
  { name: "ENCRYPTION_KEY", required: true, description: "64-char hex key for credential encryption" },
  { name: "OAUTH_STATE_SECRET", required: false, description: "OAuth state signing secret (falls back to ENCRYPTION_KEY)" },

  // AI Providers (optional — user configures what they need)
  { name: "GEMINI_API_KEY", required: false, description: "Google Gemini API key" },
  { name: "QWEN_API_KEY", required: false, description: "Alibaba Qwen/DashScope API key" },
  { name: "ANTHROPIC_API_KEY", required: false, description: "Anthropic API key" },
  { name: "XAI_API_KEY", required: false, description: "xAI/Grok API key" },

  // App
  { name: "NEXT_PUBLIC_SITE_URL", required: false, description: "Public site URL for CSRF validation" },
];

export interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

/**
 * Validate all environment variables. Returns result without throwing.
 * Call this at startup or first request.
 */
export function validateEnv(): EnvValidationResult {
  const missing: string[] = [];
  const warnings: string[] = [];

  for (const envVar of ENV_VARS) {
    const value = process.env[envVar.name];
    if (!value || value.trim() === "") {
      if (envVar.required) {
        missing.push(`${envVar.name} — ${envVar.description}`);
      } else {
        warnings.push(`${envVar.name} — ${envVar.description}`);
      }
    }
  }

  if (missing.length > 0) {
    logger.error("[Env] Missing required environment variables:", { missing: missing.join(", ") });
  }
  if (warnings.length > 0) {
    logger.warn("[Env] Optional environment variables not set:", { warnings: warnings.join(", ") });
  }

  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

/**
 * Get a required env var. Throws if not set.
 */
export function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === "") {
    throw new Error(`Required environment variable ${name} is not set`);
  }
  return value;
}

/**
 * Get an optional env var. Returns empty string if not set.
 */
export function getOptionalEnv(name: string): string {
  return process.env[name] || "";
}
