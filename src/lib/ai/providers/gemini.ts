// Gemini Provider Adapter
// Implements AIProvider interface for Google Gemini API

import { AIProvider } from "./base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../types";

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
    finishReason?: string;
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
  error?: {
    message?: string;
    code?: number;
  };
}

export class GeminiProvider extends AIProvider {
  readonly slug: AIProviderSlug = "gemini";
  readonly name = "Google Gemini";

  private baseUrl = "https://generativelanguage.googleapis.com/v1beta";

  constructor(apiKey: string) {
    super(apiKey);
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    const startTime = Date.now();
    const model = options.model || "gemini-3-flash-preview";

    const contents = [];
    if (options.systemPrompt) {
      contents.push({
        role: "user",
        parts: [{ text: options.systemPrompt }],
      });
      contents.push({
        role: "model",
        parts: [{ text: "Understood." }],
      });
    }
    contents.push({
      role: "user",
      parts: [{ text: options.prompt }],
    });

    const body: Record<string, unknown> = {
      contents,
      generationConfig: {
        temperature: options.temperature ?? 0.2,
        maxOutputTokens: options.maxOutputTokens ?? 4096,
      },
    };

    if (options.responseFormat === "json") {
      (body.generationConfig as Record<string, unknown>).responseMimeType =
        "application/json";
    }

    const response = await fetch(
      `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || `Gemini API error: ${response.status}`
      );
    }

    const data: GeminiResponse = await response.json();

    if (data.error) {
      throw new Error(data.error.message || "Gemini API error");
    }

    const content = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const inputTokens = data.usageMetadata?.promptTokenCount || 0;
    const outputTokens = data.usageMetadata?.candidatesTokenCount || 0;

    // Try to parse as JSON if requested
    let structuredData: unknown;
    if (options.responseFormat === "json") {
      try {
        structuredData = JSON.parse(content);
      } catch (parseError) {
        // JSON parsing failed — return raw content without structuredData.
        // The agent layer will handle this by parsing content directly.
        console.warn(
          `[Gemini] Response was not valid JSON despite responseFormat=json. ` +
          `Parse error: ${parseError instanceof Error ? parseError.message : "unknown"}`
        );
      }
    }

    return {
      content,
      structuredData,
      provider: "gemini",
      model,
      inputTokens,
      outputTokens,
      durationMs: Date.now() - startTime,
      cached: false,
    };
  }

  async testConnection(
    model: string
  ): Promise<AIConnectionTestResult> {
    const startTime = Date.now();
    try {
      const response = await fetch(
        `${this.baseUrl}/models/${model}:generateContent?key=${this.apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ role: "user", parts: [{ text: "Say OK" }] }],
            generationConfig: { maxOutputTokens: 10 },
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        return {
          success: false,
          provider: "gemini",
          model,
          latencyMs: Date.now() - startTime,
          error: errorData.error?.message || `HTTP ${response.status}`,
        };
      }

      return {
        success: true,
        provider: "gemini",
        model,
        latencyMs: Date.now() - startTime,
      };
    } catch (error) {
      return {
        success: false,
        provider: "gemini",
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
      const response = await fetch(
        `${this.baseUrl}/models?key=${this.apiKey}`
      );
      const data = await response.json();
      return (data.models || [])
        .filter((m: Record<string, unknown>) =>
          (m.name as string)?.includes("flash")
        )
        .map((m: Record<string, unknown>) => ({
          id: (m.name as string).replace("models/", ""),
          name: m.displayName || m.name,
          contextWindow: 1000000,
        }));
    } catch (error) {
      console.error("[Gemini] Failed to fetch available models:", error instanceof Error ? error.message : error);
      return [];
    }
  }
}
