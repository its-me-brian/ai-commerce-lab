import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentEngine } from "./engine";
import { BaseAgent } from "./agent";
import type { AgentMetadata, AgentContext, AgentResult } from "./types";
import { AIProvider } from "../../ai/providers/base";
import type {
  AIProviderSlug,
  AIGenerateOptions,
  AIGenerateResult,
  AIConnectionTestResult,
} from "../../ai/types";

// ============================================
// Mocks
// ============================================

// Mock Supabase — function-level mock with chain support
type SupabaseResult = { data: unknown; error: unknown };

const mockFrom = vi.fn();

vi.mock("../../database/supabase", () => ({
  supabase: { from: (...args: unknown[]) => mockFrom(...args) },
}));

/* eslint-disable @typescript-eslint/no-explicit-any */
function createChain(terminalResult: SupabaseResult): any {
  const terminalMethod: string = "single";
  const terminalValue: unknown = terminalResult.data;
  const terminalError: unknown = terminalResult.error;

  const chain: any = {
    select: vi.fn(() => chain),
    insert: vi.fn(() => chain),
    update: vi.fn(() => chain),
    eq: vi.fn(() => chain),
    single: vi.fn(() =>
      Promise.resolve({ data: terminalValue, error: terminalError })
    ),
  };

  // Override .eq() to resolve when it's the terminal method
  chain.eq.mockImplementation(() => {
    if (terminalMethod === "eq") {
      return Promise.resolve({ data: terminalValue, error: terminalError });
    }
    return chain;
  });

  return chain;
}

function mockQuery(terminalResult: SupabaseResult) {
  const chain = createChain(terminalResult);
  mockFrom.mockReturnValue(chain);
  return chain;
}

// ============================================
// Mock Provider
// ============================================

 
class _MockProvider extends AIProvider {
  readonly slug: AIProviderSlug = "gemini";
  readonly name = "Mock Gemini";

  async generate(options: AIGenerateOptions): Promise<AIGenerateResult> {
    return {
      content: "Mock analysis result",
      structuredData: { score: 85, recommendation: "APPROVE" },
      provider: "gemini",
      model: options.model || "gemini-3-flash",
      inputTokens: 100,
      outputTokens: 50,
      durationMs: 200,
      cached: false,
    };
  }

  async testConnection(): Promise<AIConnectionTestResult> {
    return { success: true, provider: "gemini", model: "test", latencyMs: 50 };
  }

  async getAvailableModels() {
    return [{ id: "gemini-3-flash", name: "Gemini Flash", contextWindow: 1000000 }];
  }
}

// ============================================
// Mock Router
// ============================================

const mockRouter = {
  generate: vi.fn(),
  getProvider: vi.fn(),
  registerProvider: vi.fn(),
  getExecutionLogs: vi.fn(() => []),
  getExecutionLogsByAgent: vi.fn(() => []),
};

vi.mock("../../ai/router", () => ({
  getRouter: () => mockRouter,
}));

// ============================================
// Mock Tool Registry
// ============================================

const mockToolRegistry = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn(() => [
    { id: "calculate_margin", name: "Calculate Margin" },
    { id: "search_products", name: "Search Products" },
  ]),
  has: vi.fn(),
  execute: vi.fn(),
  getToolDescriptions: vi.fn(() => []),
};

vi.mock("../../tools/bootstrap", () => ({
  getToolRegistry: () => mockToolRegistry,
}));

// ============================================
// Mock Permission Checker
// ============================================

const mockPermissionChecker = {
  hasPermission: vi.fn(() => Promise.resolve(true)),
  getAgentPermissions: vi.fn(() => Promise.resolve([])),
  getAgentRole: vi.fn(() => Promise.resolve("admin")),
  grant: vi.fn(),
  revoke: vi.fn(),
  validateExecution: vi.fn((): Promise<{ allowed: boolean; denied: string[] }> =>
    Promise.resolve({ allowed: true, denied: [] })
  ),
};

vi.mock("../../permissions/checker", () => ({
  getPermissionChecker: () => mockPermissionChecker,
}));

// ============================================
// Mock Agents
// ============================================

class MockAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "mock-agent",
    name: "Mock Agent",
    description: "A mock agent for testing",
    status: "ready",
    enabled: true,
    version: "1.0.0",
    capabilities: ["test"],
    agentType: "specialist",
  };

  validateInput(input: Record<string, unknown>): string[] {
    const errors: string[] = [];
    if (!input.query) errors.push("query is required");
    return errors;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async execute(context: AgentContext): Promise<AgentResult> {
    return {
      success: true,
      output: "Mock result",
      structuredData: { score: 85 },
      errors: [],
      metadata: {
        providerUsed: "gemini",
        modelUsed: "gemini-3-flash",
        inputTokens: 100,
        outputTokens: 50,
        durationMs: 200,
        cached: false,
      },
    };
  }
}

class FailingAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "failing-agent",
    name: "Failing Agent",
    description: "An agent that always fails",
    status: "ready",
    enabled: true,
    version: "1.0.0",
    capabilities: ["test"],
    agentType: "specialist",
  };

  async execute(): Promise<AgentResult> {
    throw new Error("Agent execution failed");
  }
}

class DisabledAgent extends BaseAgent {
  readonly metadata: AgentMetadata = {
    id: "disabled-agent",
    name: "Disabled Agent",
    description: "A disabled agent",
    status: "disabled",
    enabled: false,
    version: "1.0.0",
    capabilities: ["test"],
    agentType: "specialist",
  };

  async execute(): Promise<AgentResult> {
    return {
      success: true,
      output: "Should not reach",
      errors: [],
      metadata: {
        providerUsed: "gemini",
        modelUsed: "test",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        cached: false,
      },
    };
  }
}

// ============================================
// Mock Agent Registry
// ============================================

const mockRegistry = {
  register: vi.fn(),
  get: vi.fn(),
  list: vi.fn(() => []),
  listEnabled: vi.fn(() => []),
  has: vi.fn(),
  unregister: vi.fn(),
  registerDefinition: vi.fn(),
  getDefinition: vi.fn(),
  listDefinitions: vi.fn(() => []),
  listDefinitionsByStatus: vi.fn(() => []),
};

vi.mock("../../ai/bootstrap", () => ({
  getAgentRegistry: () => mockRegistry,
}));

// ============================================
// Helpers
// ============================================

const VALID_CONFIG_ROW = {
  agent_id: "mock-agent",
  primary_provider_id: "gemini",
  primary_model_id: "gemini-3-flash",
  fallback_provider_id: null,
  fallback_model_id: null,
  temperature: 0.2,
  max_output_tokens: 4096,
  primary_provider: { slug: "gemini" },
  primary_model: { model_id: "gemini-3-flash" },
  fallback_provider: null,
  fallback_model: null,
};

 
function setupAgentMocks(_agentId = "mock-agent", agent?: MockAgent) {
  const a = agent || new MockAgent();
  mockRegistry.get.mockReturnValue(a);
  mockRegistry.has.mockReturnValue(true);
  return a;
}

// ============================================
// Tests
// ============================================

describe("AgentEngine", () => {
  let engine: AgentEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new AgentEngine();
  });

  describe("executeTask", () => {
    it("should execute a task successfully", async () => {
      setupAgentMocks();

      // Config query (select...eq...single)
      mockQuery({ data: VALID_CONFIG_ROW, error: null });

      const { taskId, result } = await engine.executeTask("mock-agent", {
        query: "test product",
      }, { workspaceId: "test-ws" });

      expect(taskId).toBeDefined();
      expect(typeof taskId).toBe("string");
      expect(result.success).toBe(true);
      expect(result.structuredData).toEqual({ score: 85 });
    });

    it("should throw for unknown agent", async () => {
      mockRegistry.get.mockReturnValue(undefined);
      mockRegistry.has.mockReturnValue(false);

      await expect(
        engine.executeTask("unknown-agent", { query: "test" }, { workspaceId: "test-ws" })
      ).rejects.toThrow("Agent not found in registry: unknown-agent");
    });

    it("should throw for disabled agent", async () => {
      const agent = new DisabledAgent();
      mockRegistry.get.mockReturnValue(agent);
      mockRegistry.has.mockReturnValue(true);

      await expect(
        engine.executeTask("disabled-agent", { query: "test" }, { workspaceId: "test-ws" })
      ).rejects.toThrow("Agent is not enabled: disabled-agent");
    });

    it("should fail task on validation errors", async () => {
      setupAgentMocks();

      // createAndFailTask uses insert(...).eq() chain (terminal)
      mockQuery({ data: null, error: null });

      await expect(
        engine.executeTask("mock-agent", {}, { workspaceId: "test-ws" })
      ).rejects.toThrow("Input validation failed: query is required");
    });

    it("should persist task to Supabase", async () => {
      setupAgentMocks();

      // Config query
      mockQuery({ data: VALID_CONFIG_ROW, error: null });

      await engine.executeTask("mock-agent", { query: "test" }, { workspaceId: "test-ws" });

      // First .from() call is the task insert
      expect(mockFrom).toHaveBeenCalledWith("agent_tasks");
    });

    it("should persist run to Supabase on success", async () => {
      setupAgentMocks();

      // Config query
      mockQuery({ data: VALID_CONFIG_ROW, error: null });

      await engine.executeTask("mock-agent", { query: "test" }, { workspaceId: "test-ws" });

      // agent_runs insert was called
      expect(mockFrom).toHaveBeenCalledWith("agent_runs");
    });

    it("should update task status to completed on success", async () => {
      setupAgentMocks();

      // Config query
      mockQuery({ data: VALID_CONFIG_ROW, error: null });

      await engine.executeTask("mock-agent", { query: "test" }, { workspaceId: "test-ws" });

      // agent_tasks update was called
      expect(mockFrom).toHaveBeenCalledWith("agent_tasks");
    });

    it("should fail task and persist error run on execution failure", async () => {
      setupAgentMocks("failing-agent", new FailingAgent());

      // Config query
      mockQuery({ data: VALID_CONFIG_ROW, error: null });

      await expect(
        engine.executeTask("failing-agent", { query: "test" }, { workspaceId: "test-ws" })
      ).rejects.toThrow("Agent execution failed");

      // Should have attempted to persist error run
      expect(mockFrom).toHaveBeenCalledWith("agent_runs");
    });

    it("should deny execution when permissions fail", async () => {
      setupAgentMocks();

      mockPermissionChecker.validateExecution.mockResolvedValueOnce({
        allowed: false,
        denied: ["Tool access denied: search_products"],
      });

      await expect(
        engine.executeTask("mock-agent", { query: "test" }, { workspaceId: "test-ws" })
      ).rejects.toThrow("Permission denied");
    });
  });

  describe("loadAgentConfig", () => {
    it("should throw when config not found", async () => {
      setupAgentMocks();

      // Config query returns null data + error
      mockQuery({ data: null, error: { code: "PGRST116" } });

      await expect(
        engine.executeTask("mock-agent", { query: "test" }, { workspaceId: "test-ws" })
      ).rejects.toThrow("Agent config not found");
    });
  });
});
