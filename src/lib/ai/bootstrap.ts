// AI Provider Bootstrap
// The ONLY file that imports concrete provider implementations.
// Registers providers into the router based on available env vars.

import { getRouter } from "./router";
import { GeminiProvider } from "./providers/gemini";
// import { ClaudeProvider } from "./providers/claude";
// import { GrokProvider } from "./providers/grok";

let bootstrapped = false;

export function bootstrapProviders(): void {
  if (bootstrapped) return;

  const router = getRouter();

  // Gemini
  const geminiKey = process.env.GEMINI_API_KEY;
  if (geminiKey) {
    router.registerProvider(new GeminiProvider(geminiKey));
  }

  // Future providers — uncomment when implemented:
  // const anthropicKey = process.env.ANTHROPIC_API_KEY;
  // if (anthropicKey) {
  //   router.registerProvider(new ClaudeProvider(anthropicKey));
  // }

  // const xaiKey = process.env.XAI_API_KEY;
  // if (xaiKey) {
  //   router.registerProvider(new GrokProvider(xaiKey));
  // }

  bootstrapped = true;
}
