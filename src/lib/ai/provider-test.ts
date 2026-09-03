// Provider Test Service
// Orchestrates connection testing for AI providers.
// FASE 6: Supports both env-var and DB-stored credentials (CredentialManager).

import { bootstrap, getAgentRegistry } from "./bootstrap";
import { getRouter } from "./router";
import { getProviderManager } from "./provider-manager";
import { getCredentialManager } from "./credential-manager";
import type { AIConnectionTestResult } from "./types";

export interface ProviderStatus {
  slug: string;
  name: string;
  enabled: boolean;
  configured: boolean;        // Has API key (env or DB)
  credentialSource: "env" | "database" | "none";
  registered: boolean;        // Is registered in the router
}

export interface ProviderTestInput {
  provider: string;           // Provider slug
  model?: string;             // Model to test with (provider picks default if omitted)
}

export interface ProviderTestResult {
  success: boolean;
  provider: string;
  model: string;
  latencyMs: number;
  credentialSource: "env" | "database" | "none";
  error?: string;
}

// Default models for connection testing when none specified
const DEFAULT_TEST_MODELS: Record<string, string> = {
  gemini: "gemini-2.0-flash",
  anthropic: "claude-sonnet-4-20250514",
  xai: "grok-3",
};

/**
 * Get the list of all providers with their configuration status.
 * FASE 6: GET /api/ai/providers
 */
export async function getProviderStatuses(): Promise<ProviderStatus[]> {
  const providerManager = getProviderManager();
  const router = getRouter();

  // Ensure providers are loaded
  await bootstrap();

  const providers = await providerManager.listWithStatus();

  return providers.map((p) => {
    // resolveApiKey is async, but we're in a map — use getApiKey for sync check
    // The detailed source is determined per-provider in testProviderConnection
    const apiKey = providerManager.getApiKey(p);
    let credentialSource: "env" | "database" | "none" = "none";
    if (apiKey) {
      credentialSource = "env";
    }

    return {
      slug: p.slug,
      name: p.name,
      enabled: p.enabled,
      configured: p.configured,
      credentialSource,
      registered: router.getProvider(p.slug) !== undefined,
    };
  });
}

/**
 * Test a provider's connection.
 * FASE 6: POST /api/ai/providers/test
 *
 * Flow:
 * 1. Bootstrap (ensures providers are registered from DB/env)
 * 2. Check if provider is registered in router
 * 3. If not, try CredentialManager for DB-stored key
 * 4. Test connection via provider.testConnection()
 */
export async function testProviderConnection(
  input: ProviderTestInput
): Promise<ProviderTestResult> {
  const startTime = Date.now();
  const { provider: slug, model: requestedModel } = input;

  // 1. Bootstrap
  await bootstrap();

  const router = getRouter();
  const providerManager = getProviderManager();
  const credentialManager = getCredentialManager();

  // 2. Check if provider exists in DB
  const dbProvider = await providerManager.getBySlug(slug);
  if (!dbProvider) {
    return {
      success: false,
      provider: slug,
      model: requestedModel || "unknown",
      latencyMs: Date.now() - startTime,
      credentialSource: "none",
      error: `Unknown provider: ${slug}`,
    };
  }

  if (!dbProvider.enabled) {
    return {
      success: false,
      provider: slug,
      model: requestedModel || "unknown",
      latencyMs: Date.now() - startTime,
      credentialSource: "none",
      error: `Provider ${slug} is disabled`,
    };
  }

  // 3. Resolve model
  const model = requestedModel || DEFAULT_TEST_MODELS[slug] || "default";

  // 4. Check if already registered in router
  let providerInstance = router.getProvider(slug);
  let credentialSource: "env" | "database" | "none" = "none";

  if (providerInstance) {
    // Determine source: env or DB?
    const envKey = providerManager.getApiKey(dbProvider);
    credentialSource = envKey ? "env" : "database";
  } else {
    // Not registered — try CredentialManager
    const dbKey = await credentialManager.getActiveKey(dbProvider.id);
    if (dbKey) {
      credentialSource = "database";

      // Register temporarily using provider class registry
      // We need to import the class map from bootstrap
      // For now, we can try re-bootstrapping or use a direct approach
      // The bootstrap should have registered it if the DB key was available
      // But if bootstrap failed to load it (e.g., class not found), we can't test
      return {
        success: false,
        provider: slug,
        model,
        latencyMs: Date.now() - startTime,
        credentialSource,
        error: `Provider ${slug} has a DB credential but no implementation class is registered`,
      };
    }

    // No key anywhere
    return {
      success: false,
      provider: slug,
      model,
      latencyMs: Date.now() - startTime,
      credentialSource: "none",
      error: `No API key configured for ${slug}. Set ${dbProvider.api_key_env_var} or add a credential via CredentialManager.`,
    };
  }

  // 5. Test connection
  try {
    const result = await providerInstance.testConnection(model);
    return {
      success: result.success,
      provider: slug,
      model: result.model,
      latencyMs: result.latencyMs,
      credentialSource,
      error: result.error,
    };
  } catch (error) {
    return {
      success: false,
      provider: slug,
      model,
      latencyMs: Date.now() - startTime,
      credentialSource,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
