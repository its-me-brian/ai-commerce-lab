import { describe, it, expect, vi, beforeEach } from "vitest";
import { AIModelRouter } from "./router";
import { AIProvider } from "./providers/base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "./types";

// Mock supabase (needed because router.ts imports agent-model-routes → supabase)
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

// Mock agent-model-routes (not needed for legacy generate tests)
vi.mock("./agent-model-routes", () => ({
  getAgentModelRoutes: vi.fn().mockReturnValue({
    listEnabledByAgent: vi.fn().mockResolvedValue([]),
  }),
}));

// Mock model-registry (not needed for legacy generate tests)
vi.mock("./model-registry", () => ({
  getModelRegistry: vi.fn().mockReturnValue({
    getById: vi.fn().mockResolvedValue(null),
  }),
}));

// --- Mock Provider ---

class MockProvider extends AIProvider {
  readonly slug: AIProviderSlug;
  readonly name: string;
  private shouldFail = false;
  private failMessage = "Provider error";

  constructor(slug: AIProviderSlug, shouldFail = false) {
    super("test-api-key");
    this.slug = slug;
    this.name = `Mock ${slug}`;
    this.shouldFail = shouldFail;
  }

  setShouldFail(fail: boolean, message?: string) {
    this.shouldFail = fail;
    if (message) this.failMessage = message;
  }

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    if (this.shouldFail) {
      throw new Error(this.failMessage);
    }

    return {
      content: `Response from ${this.slug} for: ${options.prompt.slice(0, 50)}`,
      structuredData: { source: this.slug },
      provider: this.slug,
      model: options.model || "default-model",
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 150,
      cached: false,
    };
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    return {
      success: !this.shouldFail,
      provider: this.slug,
      model: "test-model",
      latencyMs: 50,
      error: this.shouldFail ? this.failMessage : undefined,
    };
  }

  async getAvailableModels() {
    return [{ id: "test-model", name: "Test Model", contextWindow: 100000 }];
  }
}

describe("AIModelRouter", () => {
  let router: AIModelRouter;

  beforeEach(() => {
    router = new AIModelRouter();
  });

  describe("registerProvider", () => {
    it("should register a provider", () => {
      const provider = new MockProvider("gemini");
      router.registerProvider(provider);

      expect(router.getProvider("gemini")).toBe(provider);
    });

    it("should return undefined for unknown provider", () => {
      expect(router.getProvider("gemini")).toBeUndefined();
    });
  });

  describe("generate", () => {
    it("should generate with primary provider", async () => {
      const gemini = new MockProvider("gemini");
      router.registerProvider(gemini);

      const { result, log } = await router.generate(
        {
          agentId: "test-agent",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test prompt" }
      );

      expect(result.content).toContain("gemini");
      expect(result.provider).toBe("gemini");
      expect(result.model).toBe("gemini-3-flash");
      expect(log.success).toBe(true);
      expect(log.usedFallback).toBe(false);
      expect(log.agentId).toBe("test-agent");
    });

    it("should throw for unknown primary provider", async () => {
      await expect(
        router.generate(
          {
            agentId: "test-agent",
            primaryProvider: "gemini",
            primaryModel: "gemini-3-flash",
            temperature: 0.2,
            maxTokens: 4096,
          },
          { prompt: "Test" }
        )
      ).rejects.toThrow("Provider gemini not registered");
    });

    it("should try fallback when primary fails", async () => {
      const gemini = new MockProvider("gemini", true);
      const anthropic = new MockProvider("anthropic");
      router.registerProvider(gemini);
      router.registerProvider(anthropic);

      const { result, log } = await router.generate(
        {
          agentId: "test-agent",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          fallbackProvider: "anthropic",
          fallbackModel: "claude-sonnet-4",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test prompt" }
      );

      expect(result.content).toContain("anthropic");
      expect(log.success).toBe(true);
      expect(log.usedFallback).toBe(true);
      expect(log.provider).toBe("anthropic");
    });

    it("should throw when both primary and fallback fail", async () => {
      const gemini = new MockProvider("gemini", true);
      const anthropic = new MockProvider("anthropic", true);
      router.registerProvider(gemini);
      router.registerProvider(anthropic);

      await expect(
        router.generate(
          {
            agentId: "test-agent",
            primaryProvider: "gemini",
            primaryModel: "gemini-3-flash",
            fallbackProvider: "anthropic",
            fallbackModel: "claude-sonnet-4",
            temperature: 0.2,
            maxTokens: 4096,
          },
          { prompt: "Test" }
        )
      ).rejects.toThrow();
    });

    it("should throw when fallback provider not registered", async () => {
      const gemini = new MockProvider("gemini", true);
      router.registerProvider(gemini);

      await expect(
        router.generate(
          {
            agentId: "test-agent",
            primaryProvider: "gemini",
            primaryModel: "gemini-3-flash",
            fallbackProvider: "anthropic",
            fallbackModel: "claude-sonnet-4",
            temperature: 0.2,
            maxTokens: 4096,
          },
          { prompt: "Test" }
        )
      ).rejects.toThrow("Fallback provider anthropic not registered");
    });

    it("should override temperature and maxTokens from options", async () => {
      const gemini = new MockProvider("gemini");
      router.registerProvider(gemini);

      const { result } = await router.generate(
        {
          agentId: "test-agent",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test", temperature: 0.8, maxOutputTokens: 2048 }
      );

      expect(result.content).toContain("gemini");
    });
  });

  describe("execution logs", () => {
    it("should log successful execution", async () => {
      const gemini = new MockProvider("gemini");
      router.registerProvider(gemini);

      await router.generate(
        {
          agentId: "test-agent",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test" }
      );

      const logs = router.getExecutionLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(true);
      expect(logs[0].agentId).toBe("test-agent");
    });

    it("should log failed execution", async () => {
      const gemini = new MockProvider("gemini", true);
      router.registerProvider(gemini);

      try {
        await router.generate(
          {
            agentId: "test-agent",
            primaryProvider: "gemini",
            primaryModel: "gemini-3-flash",
            temperature: 0.2,
            maxTokens: 4096,
          },
          { prompt: "Test" }
        );
      } catch {
        // Expected
      }

      const logs = router.getExecutionLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].success).toBe(false);
      expect(logs[0].error).toBe("Provider error");
    });

    it("should filter logs by agent", async () => {
      const gemini = new MockProvider("gemini");
      router.registerProvider(gemini);

      await router.generate(
        {
          agentId: "agent-1",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test 1" }
      );

      await router.generate(
        {
          agentId: "agent-2",
          primaryProvider: "gemini",
          primaryModel: "gemini-3-flash",
          temperature: 0.2,
          maxTokens: 4096,
        },
        { prompt: "Test 2" }
      );

      const agent1Logs = router.getExecutionLogsByAgent("agent-1");
      expect(agent1Logs).toHaveLength(1);
      expect(agent1Logs[0].agentId).toBe("agent-1");
    });
  });
});
