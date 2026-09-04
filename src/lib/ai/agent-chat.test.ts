// Agent Chat Service Tests

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockGetAgent, mockGetDefinition, mockGenerateForAgent, mockCreate, mockGetById, mockAddMessage, mockGetLastMessages, mockBuildCompanyContext, mockFormatContextForPrompt, mockListByAgent, mockGetOrCreateDirect } = vi.hoisted(() => ({
  mockGetAgent: vi.fn(),
  mockGetDefinition: vi.fn(),
  mockGenerateForAgent: vi.fn(),
  mockCreate: vi.fn(),
  mockGetById: vi.fn(),
  mockAddMessage: vi.fn(),
  mockGetLastMessages: vi.fn(),
  mockBuildCompanyContext: vi.fn(),
  mockFormatContextForPrompt: vi.fn().mockReturnValue(""),
  mockListByAgent: vi.fn().mockResolvedValue([]),
  mockGetOrCreateDirect: vi.fn(),
}));

vi.mock("./bootstrap", () => ({
  bootstrap: vi.fn().mockResolvedValue(undefined),
  getAgentRegistry: vi.fn().mockReturnValue({
    get: mockGetAgent,
    getDefinition: (...args: unknown[]) => mockGetDefinition(...args),
  }),
}));

vi.mock("./router", () => ({
  getRouter: vi.fn().mockReturnValue({
    generateForAgent: mockGenerateForAgent,
  }),
}));

vi.mock("./conversation-engine", () => ({
  getConversationEngine: vi.fn().mockReturnValue({
    create: mockCreate,
    getById: mockGetById,
    addMessage: mockAddMessage,
    getLastMessages: mockGetLastMessages,
    getOrCreateDirect: mockGetOrCreateDirect,
  }),
}));

vi.mock("../workspaces/service", () => ({
  getWorkspaceService: vi.fn().mockReturnValue({
    buildCompanyContext: mockBuildCompanyContext,
    formatContextForPrompt: mockFormatContextForPrompt,
  }),
}));

vi.mock("./task-engine", () => ({
  getTaskEngine: vi.fn().mockReturnValue({
    listByAgent: mockListByAgent,
  }),
}));

vi.mock("./prompt-pipeline", () => ({
  preprocessMessage: vi.fn().mockResolvedValue({
    canAnswerWithoutLLM: false,
    isStatusQuery: false,
  }),
  buildEnrichedPrompt: vi.fn().mockImplementation((_base: string) => _base),
  generateStatusResponse: vi.fn().mockReturnValue(""),
}));

vi.mock("./observability", () => ({
  getStructuredLogger: vi.fn().mockReturnValue({
    log: vi.fn(),
  }),
  getExecutionTracer: vi.fn().mockReturnValue({
    startTrace: vi.fn().mockReturnValue("trace-test"),
    endSpan: vi.fn(),
  }),
}));

import { chatWithAgent } from "./agent-chat";

describe("AgentChat", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAgent.mockReturnValue({ id: "product-hunter", name: "Product Hunter" });
    mockGetDefinition.mockReturnValue({
      id: "product-hunter",
      name: "Product Hunter",
      identity: { name: "Product Hunter", role: "Product Research Specialist", description: "Finds trending products" },
      mission: "Find trending products",
      personality: { traits: ["analytical", "curious"], communicationStyle: ["data-driven"], decisionStyle: "data-driven" },
      expertise: ["product_analysis"],
      rules: ["Be accurate"],
    });
  });

  it("should throw for unknown agent", async () => {
    mockGetAgent.mockReturnValue(null);

    await expect(
      chatWithAgent({ agentId: "unknown", message: "Hello" })
    ).rejects.toThrow("Agent not found");
  });

  it("should create a new conversation when none provided", async () => {
    const mockConv = {
      id: "conv-new",
      agent_id: "product-hunter",
      status: "active",
      message_count: 0,
    };
    mockGetOrCreateDirect.mockResolvedValue(mockConv);
    mockGetLastMessages.mockResolvedValue([]);
    mockGenerateForAgent.mockResolvedValue({
      result: {
        content: "Hi! I can help with product research.",
        inputTokens: 50,
        outputTokens: 20,
        durationMs: 100,
      },
      log: {
        provider: "gemini",
        model: "gemini-3-flash",
        success: true,
      },
    });

    mockAddMessage
      .mockResolvedValueOnce({ id: "msg-1", role: "user", content: "Hello" })
      .mockResolvedValueOnce({
        id: "msg-2",
        role: "assistant",
        content: "Hi! I can help with product research.",
        provider: "gemini",
        model: "gemini-3-flash",
        input_tokens: 50,
        output_tokens: 20,
        duration_ms: 100,
      });

    const result = await chatWithAgent({
      agentId: "product-hunter",
      message: "Hello",
    });

    expect(result.conversation.id).toBe("conv-new");
    expect(result.userMessage.role).toBe("user");
    expect(result.assistantMessage.role).toBe("assistant");
    expect(mockGetOrCreateDirect).toHaveBeenCalledWith("product-hunter", undefined);
  });

  it("should continue existing conversation", async () => {
    const mockConv = {
      id: "conv-existing",
      agent_id: "product-hunter",
      status: "active",
      message_count: 2,
    };
    mockGetById.mockResolvedValue(mockConv);
    mockGetLastMessages.mockResolvedValue([
      { id: "msg-1", role: "user", content: "First message" },
      { id: "msg-2", role: "assistant", content: "First response" },
    ]);
    mockGenerateForAgent.mockResolvedValue({
      result: {
        content: "Follow up response",
        inputTokens: 80,
        outputTokens: 30,
        durationMs: 120,
      },
      log: {
        provider: "gemini",
        model: "gemini-3-flash",
        success: true,
      },
    });

    mockAddMessage
      .mockResolvedValueOnce({ id: "msg-3", role: "user", content: "Follow up" })
      .mockResolvedValueOnce({
        id: "msg-4",
        role: "assistant",
        content: "Follow up response",
        provider: "gemini",
        model: "gemini-3-flash",
        input_tokens: 80,
        output_tokens: 30,
        duration_ms: 120,
      });

    const result = await chatWithAgent({
      agentId: "product-hunter",
      conversationId: "conv-existing",
      message: "Follow up",
    });

    expect(result.conversation.id).toBe("conv-existing");
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockGetById).toHaveBeenCalledWith("conv-existing");
  });

  it("should throw for non-active conversation", async () => {
    mockGetById.mockResolvedValue({
      id: "conv-archived",
      status: "archived",
    });

    await expect(
      chatWithAgent({
        agentId: "product-hunter",
        conversationId: "conv-archived",
        message: "Hello",
      })
    ).rejects.toThrow("not active");
  });

  it("should throw for non-existent conversation", async () => {
    mockGetById.mockResolvedValue(null);

    await expect(
      chatWithAgent({
        agentId: "product-hunter",
        conversationId: "conv-doesnt-exist",
        message: "Hello",
      })
    ).rejects.toThrow("Conversation not found");
  });

  it("should include system prompt from agent definition", async () => {
    mockGetDefinition.mockReturnValue({
      identity: {
        name: "Product Research Specialist",
        role: "Product Research",
        description: "Research products",
      },
      mission: "Find the best products",
      personality: { traits: ["analytical"], communicationStyle: ["direct"] },
      expertise: ["market research"],
      rules: ["always cite sources"],
    });

    mockGetOrCreateDirect.mockResolvedValue({
      id: "conv-1",
      agent_id: "product-hunter",
      status: "active",
    });
    mockGetLastMessages.mockResolvedValue([]);
    mockGenerateForAgent.mockResolvedValue({
      result: {
        content: "Response",
        inputTokens: 10,
        outputTokens: 10,
        durationMs: 50,
      },
      log: { provider: "gemini", model: "gemini-3-flash", success: true },
    });

    mockAddMessage
      .mockResolvedValueOnce({ id: "msg-1", role: "user", content: "Test" })
      .mockResolvedValueOnce({
        id: "msg-2",
        role: "assistant",
        content: "Response",
        provider: "gemini",
        model: "gemini-3-flash",
        input_tokens: 10,
        output_tokens: 10,
        duration_ms: 50,
      });

    await chatWithAgent({
      agentId: "product-hunter",
      message: "Test",
    });

    expect(mockGenerateForAgent).toHaveBeenCalledWith(
      "product-hunter",
      expect.objectContaining({
        systemPrompt: expect.stringContaining("Product Research Specialist"),
      }),
      { workspaceId: "" },
    );
  });
});
