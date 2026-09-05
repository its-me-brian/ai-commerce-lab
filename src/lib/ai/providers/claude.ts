// Claude Provider Adapter
// Implements AIProvider interface for Anthropic Claude API

import { logger } from "../../logging";
import { AIProvider } from "./base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

interface ClaudeResponse {
  id?: string;
  content?: Array<{ type: string; text?: string }>;
  stop_reason?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

export class ClaudeProvider extends AIProvider {
  readonly slug: AIProviderSlug = "anthropic";
  readonly name = "Anthropic Claude";

  private baseUrl = "https://api.anthropic.com/v1";
  private apiVersion = "2023-06-01";

  constructor(apiKey: string) {
    super(apiKey);
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const model = options.model || "claude-sonnet-4-20250514";

    const messages: Array<{ role: string; content: string }> = [];
    messages.push({ role: "user", content: options.prompt });

    const body: Record<string, unknown> = {
      model,
      max_tokens: options.maxOutputTokens ?? 4096,
      messages,
    };

    if (options.systemPrompt) {
      body.system = options.systemPrompt;
    }

    if (options.temperature !== undefined) {
      body.temperature = options.temperature;
    }

    if (options.responseFormat === "json") {
      // Claude doesn't have a native JSON mode, but we can instruct it in the system prompt
      // The system prompt should already request JSON output
    }

    const response = await fetch(`${this.baseUrl}/messages`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
        "anthropic-version": this.apiVersion,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Claude API error: ${response.status}`
      );
    }

    const data: ClaudeResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Claude API error");
    }

    const content = data.content?.[0]?.text || "";
    const inputTokens = data.usage?.input_tokens || 0;
    const outputTokens = data.usage?.output_tokens || 0;

    // Try to parse as JSON if requested
    let structuredData: unknown;
    if (options.responseFormat === "json") {
      try {
        structuredData = JSON.parse(content);
      } catch (parseError) {
        logger.warn(
          `[Claude] Response was not valid JSON despite responseFormat=json. ` +
          `Parse error: ${parseError instanceof Error ? parseError.message : "unknown"}`
        );
      }
    }

    return {
      content,
      structuredData,
      provider: "anthropic",
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
      const response = await fetch(`${this.baseUrl}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": this.apiKey,
          "anthropic-version": this.apiVersion,
        },
        body: JSON.stringify({
          model,
          max_tokens: 10,
          messages: [{ role: "user", content: "Say OK" }],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: "anthropic",
          model,
          latencyMs: Date.now() - startTime,
          error: errorData.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        provider: "anthropic",
        model,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        provider: "anthropic",
        model,
        latencyMs: Date.now() - startTime,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async getAvailableModels(): Promise<
    Array<{ id: string; name: string; contextWindow: number }>
  > {
    // Anthropic doesn't have a public models list API
    // Return known models
    return [
      { id: "claude-sonnet-4-20250514", name: "Claude Sonnet 4", contextWindow: 200000 },
      { id: "claude-3-5-haiku-20241022", name: "Claude 3.5 Haiku", contextWindow: 200000 },
    ];
  }
}
