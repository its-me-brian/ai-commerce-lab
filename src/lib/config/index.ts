// Configuration
// Central configuration for the application.
// NOTE: Service role key is NOT exposed here — use import from database/supabase directly.

export const config = {
  // Application
  app: {
    name: "AI Commerce Lab",
    version: "0.1.0",
  },

  // Supabase (public keys only — service role is server-only via supabase.ts)
  supabase: {
    url: process.env.SUPABASE_URL || "",
    anonKey: process.env.SUPABASE_ANON_KEY || "",
  },

  // AI Providers
  ai: {
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
    },
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
    },
    xai: {
      apiKey: process.env.XAI_API_KEY || "",
    },
  },

  // Default agent configurations
  agents: {
    "product-hunter": {
      primaryProvider: "gemini" as const,
      primaryModel: "gemini-3-flash-preview",
      fallbackProvider: undefined as "anthropic" | undefined,
      fallbackModel: undefined as string | undefined,
      temperature: 0.2,
      maxTokens: 4096,
    },
  },

  // Cost estimation (per million tokens)
  costs: {
    "gemini-3-flash-preview": { input: 0, output: 0 }, // Free tier
    "claude-3-5-haiku": { input: 0.8, output: 4 },
    "grok-3-mini": { input: 0.3, output: 0.5 },
  },
} as const;

export type AppConfig = typeof config;
