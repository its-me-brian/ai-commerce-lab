// Ollama Provider Adapter
// Implements AIProvider interface for local Ollama instance.
//
// Ollama runs locally (or on a local network) and exposes an OpenAI-compatible API.
// Default endpoint: http://localhost:11434/v1
//
// Key difference from cloud providers:
//   - No API key required (local inference)
//   - No cost per token
//   - Latency depends on local hardware
//   - Model must be pre-downloaded via `ollama pull`

import { AIProvider } from "./base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

interface OllamaChatResponse {
  choices?: Array<{
    message?: { content?: string };
    finish_reason?: string;
  }>;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
  error?: { message?: string };
}

export class OllamaProvider extends AIProvider {
  readonly slug: AIProviderSlug = "ollama";
  readonly name = "Ollama (Local)";

  private baseUrl: string;

  constructor(apiKey: string = "ollama", baseUrl: string = "http://localhost:11434") {
    super(apiKey); // Ollama doesn't use API keys, but base class requires one
    this.baseUrl = baseUrl;
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const model = options.model || "llama3.2";

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: options.prompt });

    const body: Record<string, unknown> = {
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxOutputTokens ?? 2048,
      stream: false,
    };

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Ollama error ${response.status}: ${text}`);
    }

    const data: OllamaChatResponse = await response.json();

    if (data.error) {
      throw new Error(`Ollama error: ${data.error.message}`);
    }

    const content = data.choices?.[0]?.message?.content ?? "";
    const durationMs = Date.now() - startTime;

    return {
      content,
      provider: this.slug,
      model,
      inputTokens: data.usage?.prompt_tokens ?? this.estimateTokens(options.prompt),
      outputTokens: data.usage?.completion_tokens ?? this.estimateTokens(content),
      durationMs,
      cached: false,
    };
  }

  async testConnection(model: string): Promise<AIConnectionTestResult> {
    const startTime = Date.now();
    try {
      const result = await this.generate({
        prompt: "Say hello in one word.",
        model,
        maxOutputTokens: 10,
      });
      return {
        success: true,
        provider: this.slug,
        model,
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      return {
        success: false,
        provider: this.slug,
        model,
        latencyMs: Date.now() - startTime,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  }

  async getAvailableModels(): Promise<Array<{ id: string; name: string; contextWindow: number }>> {
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) return [];

      const data = await response.json();
      const models = data.models ?? [];

      return models.map((m: { name: string; details?: { parameter_size?: string } }) => ({
        id: m.name,
        name: m.name,
        contextWindow: 4096, // Ollama doesn't expose context window via API; default estimate
      }));
    } catch {
      return [];
    }
  }
}
