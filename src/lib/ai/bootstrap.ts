// Application Bootstrap
// The ONLY file that imports concrete implementations (providers, agents, definitions).
// Registers everything into singletons (router, registry).
//
// FASE 4: Providers are now registered from DB via ProviderManager.
// Concrete provider classes are still needed for API calls, but registration is dynamic.

import { getRouter } from "./router";
import { GeminiProvider } from "./providers/gemini";
import { ClaudeProvider } from "./providers/claude";
import { GrokProvider } from "./providers/grok";
import { WorkersAIProvider } from "./providers/workers-ai";
import { OpenAICompatibleProvider } from "./providers/openai-compatible";
import { getProviderManager } from "./provider-manager";
import { bootstrapMiniAIs } from "./mini-ai/bootstrap";
import { bootstrapWorkflows } from "./workflow/bootstrap";

import { AgentRegistry } from "../agents/core/registry";
import { ProductHunterAgent } from "../agents/product-hunter";
import { SupplierResearchAgent } from "../agents/supplier-research";
import { MarketResearchAgent } from "../agents/market-research";
import { OpportunityScoringAgent } from "../agents/opportunity-scoring";
import { CEOAgent } from "../agents/ceo";
import { StoreBuilderAgent } from "../agents/store-builder";
import { MarketingAgent } from "../agents/marketing";
import { SecretaryAgent } from "../agents/secretary";
import { FinanceAgent } from "../agents/finance";

// Agent Definitions (identity, mission, personality, expertise, rules, skills)
import { agentDefinitions } from "../agents/definitions";
import { loadDefinitionsFromDB } from "../agents/definition-loader";

// Provider class registry — maps slug to constructor
// This allows dynamic provider registration while keeping type safety
type ProviderConstructor = new (apiKey: string) => import("./providers/base").AIProvider;

const providerClasses: Record<string, ProviderConstructor> = {
  gemini: GeminiProvider,
  anthropic: ClaudeProvider,
  xai: GrokProvider,
  "workers-ai": WorkersAIProvider,
};

// Known OpenAI-compatible providers — slug → default base URL
// These are used as fallback when a DB provider has a base_url but no concrete class
const openAICompatibleDefaults: Record<string, string> = {
  qwen: "https://dashscope.aliyuncs.com/compatible-mode/v1",
  deepseek: "https://api.deepseek.com/v1",
  mistral: "https://api.mistral.ai/v1",
  groq: "https://api.groq.com/openai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
};

let bootstrapped = false;

/**
 * Initialize all providers, agents, and definitions.
 * Called once per server process. Safe to call multiple times (idempotent).
 *
 * FASE 4: Uses ProviderManager to load providers from DB.
 * Falls back to hardcoded providers if DB is unavailable.
 */
export async function bootstrap(): Promise<void> {
  if (bootstrapped) return;

  const router = getRouter();
  const providerManager = getProviderManager();

  // Try to load providers from DB
  try {
    const dbProviders = await providerManager.listEnabled();

    for (const dbProvider of dbProviders) {
      // Resolve API key: env var → CredentialManager (DB-stored)
      const { key: apiKey, source } = await providerManager.resolveApiKey(dbProvider);
      if (!apiKey) {
        console.log(
          `[Bootstrap] Skipping provider ${dbProvider.slug} — no API key configured (env or DB)`
        );
        continue;
      }

      console.log(`[Bootstrap] Resolved API key for ${dbProvider.slug} from ${source}`);

      // Check if we have a concrete class for this provider
      const ProviderClass = providerClasses[dbProvider.slug];
      if (ProviderClass) {
        router.registerProvider(new ProviderClass(apiKey));
        console.log(`[Bootstrap] Registered provider from DB: ${dbProvider.slug}`);
      } else if (dbProvider.base_url || openAICompatibleDefaults[dbProvider.slug]) {
        // OpenAI-compatible provider — use base URL from DB or known defaults
        const baseUrl = dbProvider.base_url || openAICompatibleDefaults[dbProvider.slug];
        const defaultModel = (dbProvider.config as Record<string, unknown>)?.defaultModel as string | undefined;
        router.registerProvider(
          new OpenAICompatibleProvider(
            dbProvider.slug,
            apiKey,
            baseUrl,
            dbProvider.name,
            defaultModel
          )
        );
        console.log(`[Bootstrap] Registered OpenAI-compatible provider from DB: ${dbProvider.slug}`);
      } else {
        console.warn(
          `[Bootstrap] No provider class for slug: ${dbProvider.slug} — API key configured but no implementation`
        );
      }
    }
  } catch (error) {
    // DB not available — fall back to hardcoded providers
    console.warn(
      `[Bootstrap] Failed to load providers from DB, using hardcoded fallback:`,
      error instanceof Error ? error.message : error
    );

    const geminiKey = process.env.GEMINI_API_KEY;
    if (geminiKey) {
      router.registerProvider(new GeminiProvider(geminiKey));
    }

    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (anthropicKey) {
      router.registerProvider(new ClaudeProvider(anthropicKey));
    }

    const xaiKey = process.env.XAI_API_KEY;
    if (xaiKey) {
      router.registerProvider(new GrokProvider(xaiKey));
    }

    // Workers AI — requires CLOUDFLARE_ACCOUNT_ID and CLOUDFLARE_API_TOKEN
    const cfAccountId = process.env.CLOUDFLARE_ACCOUNT_ID;
    const cfApiToken = process.env.CLOUDFLARE_API_TOKEN;
    if (cfAccountId && cfApiToken) {
      router.registerProvider(new WorkersAIProvider(`${cfAccountId}:${cfApiToken}`));
      console.log(`[Bootstrap] Registered Workers AI provider`);
    }

    // OpenAI-compatible providers — Qwen, DeepSeek, etc.
    const qwenKey = process.env.QWEN_API_KEY;
    if (qwenKey) {
      router.registerProvider(
        new OpenAICompatibleProvider(
          "qwen",
          qwenKey,
          "https://dashscope.aliyuncs.com/compatible-mode/v1",
          "Alibaba Qwen"
        )
      );
      console.log(`[Bootstrap] Registered Qwen provider`);
    }

    const deepseekKey = process.env.DEEPSEEK_API_KEY;
    if (deepseekKey) {
      router.registerProvider(
        new OpenAICompatibleProvider(
          "deepseek",
          deepseekKey,
          "https://api.deepseek.com/v1",
          "DeepSeek"
        )
      );
      console.log(`[Bootstrap] Registered DeepSeek provider`);
    }
  }

  // --- Agents ---
  const registry = getAgentRegistry();
  registry.register(new ProductHunterAgent());
  registry.register(new SupplierResearchAgent());
  registry.register(new MarketResearchAgent());
  registry.register(new OpportunityScoringAgent());
  registry.register(new CEOAgent());
  registry.register(new StoreBuilderAgent());
  registry.register(new MarketingAgent());
  registry.register(new SecretaryAgent());
  registry.register(new FinanceAgent());

  // --- Agent Definitions (DB-first with hardcoded fallback) ---
  const definitions = await loadDefinitionsFromDB();
  for (const definition of Object.values(definitions)) {
    registry.registerDefinition(definition);
  }

  // --- Mini-IAs (built-in deterministic + LLM implementations) ---
  bootstrapMiniAIs();

  // --- Workflows (built-in DAG definitions) ---
  await bootstrapWorkflows();

  bootstrapped = true;
}

/**
 * Register a new provider class at runtime.
 * Allows extending the system with new providers without code changes to bootstrap.
 */
export function registerProviderClass(slug: string, ProviderClass: ProviderConstructor): void {
  providerClasses[slug] = ProviderClass;
}

// --- Singleton AgentRegistry ---

let _registry: AgentRegistry | null = null;

export function getAgentRegistry(): AgentRegistry {
  if (!_registry) {
    _registry = new AgentRegistry();
  }
  return _registry;
}

/**
 * @deprecated Use bootstrap() instead. Kept for backward compatibility.
 */
export function bootstrapProviders(): void {
  bootstrap();
}
