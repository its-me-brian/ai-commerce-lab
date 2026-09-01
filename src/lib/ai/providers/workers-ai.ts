// Cloudflare Workers AI Provider Adapter
// Implements AIProvider interface for Cloudflare's Workers AI platform.
//
// Workers AI runs models on Cloudflare's edge network.
// Uses the REST API: https://api.cloudflare.com/client/v4/accounts/{account_id}/ai/run/{model}
//
// Requires:
//   - CLOUDFLARE_ACCOUNT_ID
//   - CLOUDFLARE_API_TOKEN
//
// Pricing: Free tier includes 10,000 neurons/day.
// After free tier: pay per neuron-second.

import { AIProvider } from "./base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

interface WorkersAIResponse {
  result?: {
    response?: string;
  };
  success?: boolean;
  errors?: Array<{ message?: string }>;
}

export class WorkersAIProvider extends AIProvider {
  readonly slug: AIProviderSlug = "workers-ai";
  readonly name = "Cloudflare Workers AI";

  private accountId: string;
  private apiToken: string;

  constructor(apiKey: string) {
    // apiKey format: "accountId:apiToken"
    super(apiKey);
    const parts = apiKey.split(":");
    this.accountId = parts[0] || "";
    this.apiToken = parts[1] || "";
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const startTime = Date.now();
    // Workers AI model format: "@cf/meta/llama-3.2-3b-instruct" or "llama-3.2-3b-instruct"
    const model = options.model || "@cf/meta/llama-3.2-3b-instruct";

    const messages: Array<{ role: string; content: string }> = [];
    if (options.systemPrompt) {
      messages.push({ role: "system", content: options.systemPrompt });
    }
    messages.push({ role: "user", content: options.prompt });

    const body: Record<string, unknown> = {
      messages,
      max_tokens: options.maxOutputTokens ?? 1024,
      temperature: options.temperature ?? 0.7,
    };

    if (options.responseFormat === "json") {
      body.response_format = { type: "json_object" };
    }

    const response = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${this.accountId}/ai/run/${model}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiToken}`,
        },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Workers AI error ${response.status}: ${text}`);
    }

    const data: WorkersAIResponse = await response.json();

    if (!data.success) {
      const errMsg = data.errors?.[0]?.message || "Unknown Workers AI error";
      throw new Error(`Workers AI error: ${errMsg}`);
    }

    const content = data.result?.response ?? "";
    const durationMs = Date.now() - startTime;

    return {
      content,
      provider: this.slug,
      model,
      inputTokens: this.estimateTokens(options.prompt),
      outputTokens: this.estimateTokens(content),
      durationMs,
      cached: false,
    };
  }

  async testConnection(model: string): Promise<AIConnectionTestResult> {
    const startTime = Date.now();
    try {
      await this.generate({
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
    // Workers AI doesn't have a list models endpoint; return known models
    return [
      { id: "@cf/meta/llama-3.2-3b-instruct", name: "Llama 3.2 3B", contextWindow: 4096 },
      { id: "@cf/meta/llama-3.1-8b-instruct", name: "Llama 3.1 8B", contextWindow: 8192 },
      { id: "@cf/mistral/mistral-7b-instruct-v0.2", name: "Mistral 7B", contextWindow: 8192 },
      { id: "@cf/google/gemma-2b-it", name: "Gemma 2B", contextWindow: 2048 },
      { id: "@cf/qwen/qwen1.5-14b-chat-awq", name: "Qwen 1.5 14B", contextWindow: 8192 },
    ];
  }
}
