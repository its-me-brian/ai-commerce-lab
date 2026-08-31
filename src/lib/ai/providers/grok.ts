// Grok Provider Adapter
// Implements AIProvider interface for xAI Grok API (OpenAI-compatible)

import { AIProvider } from "./base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

interface GrokResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  error?: {
    message: string;
    type: string;
  };
}

export class GrokProvider extends AIProvider {
  readonly slug: AIProviderSlug = "xai";
  readonly name = "xAI Grok";

  private baseUrl = "https://api.x.ai/v1";

  constructor(apiKey: string) {
    super(apiKey);
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const model = options.model || "grok-3-mini-latest";

    const messages: Array<{ role: string; content: string }> = [];

    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: options.prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      max_tokens: options.maxOutputTokens ?? 4096,
    };

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Grok API error: ${response.status}`
      );
    }

    const data: GrokResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Grok API error");
    }

    const content = data.choices?.[0]?.message?.content || "";
    const inputTokens = data.usage?.prompt_tokens || 0;
    const outputTokens = data.usage?.completion_tokens || 0;

    // Try to parse as JSON if requested
    let structuredData: unknown;
    if (options.responseFormat === "json") {
      try {
        structuredData = JSON.parse(content);
      } catch (parseError) {
        console.warn(
          `[Grok] Response was not valid JSON despite responseFormat=json. ` +
          `Parse error: ${parseError instanceof Error ? parseError.message : "unknown"}`
        );
      }
    }

    return {
      content,
      structuredData,
      provider: "xai",
      model,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - startTime,
      cached: false,
    };
  }

  async testConnection(model: string): Promise<AIConnectionTestResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "user", content: "Say OK" }],
          max_tokens: 10,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: "xai",
          model,
          latencyMs: Date.now() - startTime,
          error: errorData.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        provider: "xai",
        model,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        provider: "xai",
        model,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAvailableModels(): Promise<
    Array<{ id: string; name: string; contextWindow: number }>
  > {
    try {
      const response = await fetch(`${this.baseUrl}/models`, {
        headers: { Authorization: `Bearer ${this.apiKey}` },
      });
      const data = await response.json();
      return (data.data || []).map((m: { id: string; name?: string }) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: 128000,
      }));
    } catch {
      return [
        { id: "grok-3-mini-latest", name: "Grok 3 Mini", contextWindow: 128000 },
      ];
    }
  }
}
