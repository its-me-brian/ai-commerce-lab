// Application Bootstrap
// The ONLY file that imports concrete implementations (providers, agents).
// Registers everything into singletons (router, registry).

import { getRouter } from "./router";
import { GeminiProvider } from "./providers/gemini";
import { ClaudeProvider } from "./providers/claude";
import { GrokProvider } from "./providers/grok";

import { AgentRegistry } from "../agents/core/registry";
import { ProductHunterAgent } from "../agents/product-hunter";
import { SupplierResearchAgent } from "../agents/supplier-research";
import { MarketResearchAgent } from "../agents/market-research";
import { OpportunityScoringAgent } from "../agents/opportunity-scoring";
import { CEOAgent } from "../agents/ceo";
import { StoreBuilderAgent } from "../agents/store-builder";
import { MarketingAgent } from "../agents/marketing";
// import { SecretaryAgent } from "../agents/secretary";
// import { FinanceAgent } from "../agents/finance";

let bootstrapped = false;

/**
 * Initialize all providers and agents.
 * Called once per server process. Safe to call multiple times (idempotent).
 */
export function bootstrap(): void {
  if (bootstrapped) return;

  // --- Providers ---
  const router = getRouter();

  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    router.registerProvider(new GeminiProvider(geminiKey));
  }

  // Future providers — uncomment when implemented:
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    router.registerProvider(new ClaudeProvider(anthropicKey));
  }

  const xaiKey = process.env.XAI_API_KEY;
  if (xaiKey) {
    router.registerProvider(new GrokProvider(xaiKey));
  }
  // if (xaiKey) {
  //   router.registerProvider(new GrokProvider(xaiKey));
  // }

  // --- Agents ---
  const registry = getAgentRegistry();
  registry.register(new ProductHunterAgent());
  registry.register(new SupplierResearchAgent());
  registry.register(new MarketResearchAgent());
  registry.register(new OpportunityScoringAgent());
  registry.register(new CEOAgent());
  registry.register(new StoreBuilderAgent());
  registry.register(new MarketingAgent());
  // registry.register(new SecretaryAgent());
  // registry.register(new FinanceAgent());
  // registry.register(new CEOAgent());

  bootstrapped = true;
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
