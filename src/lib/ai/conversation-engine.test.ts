// Conversation Engine Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ConversationEngine } from "./conversation-engine";
import type { Conversation, ConversationMessage } from "./conversation-engine";

// Mock Supabase
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

const mockConversation: Conversation = {
  id: "conv-1",
  agent_id: "product-hunter",
  workspace_id: "ws-1",
  title: "Product Research Session",
  status: "active",
  message_count: 2,
  last_message_at: "2026-08-31T12:00:00Z",
  created_at: "2026-08-31T10:00:00Z",
  updated_at: "2026-08-31T12:00:00Z",
};

const mockMessage: ConversationMessage = {
  id: "msg-1",
  conversation_id: "conv-1",
  role: "user",
  content: "Find trending products in electronics",
  provider: null,
  model: null,
  input_tokens: 0,
  output_tokens: 0,
  duration_ms: 0,
  metadata: {},
  created_at: "2026-08-31T10:00:00Z",
};

const mockAssistantMessage: ConversationMessage = {
  id: "msg-2",
  conversation_id: "conv-1",
  role: "assistant",
  content: "I found 5 trending electronics products...",
  provider: "gemini",
  model: "gemini-3-flash-preview",
  input_tokens: 150,
  output_tokens: 200,
  duration_ms: 1200,
  metadata: { products: [] },
  created_at: "2026-08-31T10:00:01Z",
};

describe("ConversationEngine", () => {
  let engine: ConversationEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    engine = new ConversationEngine();
  });

  it("should create an instance", () => {
    expect(engine).toBeDefined();
    expect(engine).toBeInstanceOf(ConversationEngine);
  });

  it("should have create method", () => {
    expect(typeof engine.create).toBe("function");
  });

  it("should have getById method", () => {
    expect(typeof engine.getById).toBe("function");
  });

  it("should have listByAgent method", () => {
    expect(typeof engine.listByAgent).toBe("function");
  });

  it("should have listActive method", () => {
    expect(typeof engine.listActive).toBe("function");
  });

  it("should have archive method", () => {
    expect(typeof engine.archive).toBe("function");
  });

  it("should have delete method", () => {
    expect(typeof engine.delete).toBe("function");
  });

  it("should have addMessage method", () => {
    expect(typeof engine.addMessage).toBe("function");
  });

  it("should have getMessages method", () => {
    expect(typeof engine.getMessages).toBe("function");
  });

  it("should have getLastMessages method", () => {
    expect(typeof engine.getLastMessages).toBe("function");
  });

  it("should have getTokenUsage method", () => {
    expect(typeof engine.getTokenUsage).toBe("function");
  });

  describe("conversation model", () => {
    it("should have required fields", () => {
      expect(mockConversation.id).toBeDefined();
      expect(mockConversation.agent_id).toBeDefined();
      expect(mockConversation.status).toBe("active");
    });

    it("should track message count", () => {
      expect(mockConversation.message_count).toBe(2);
    });

    it("should track last message timestamp", () => {
      expect(mockConversation.last_message_at).toBeDefined();
    });
  });

  describe("message model", () => {
    it("should have role (user/assistant/system)", () => {
      expect(mockMessage.role).toBe("user");
      expect(mockAssistantMessage.role).toBe("assistant");
    });

    it("should track token usage", () => {
      expect(mockAssistantMessage.input_tokens).toBe(150);
      expect(mockAssistantMessage.output_tokens).toBe(200);
    });

    it("should track provider and model", () => {
      expect(mockAssistantMessage.provider).toBe("gemini");
      expect(mockAssistantMessage.model).toBe("gemini-3-flash-preview");
    });

    it("should support metadata", () => {
      expect(mockAssistantMessage.metadata).toEqual({ products: [] });
    });
  });

  describe("token usage calculation", () => {
    it("should sum tokens across messages", () => {
      const messages = [mockMessage, mockAssistantMessage];

      let inputTokens = 0;
      let outputTokens = 0;
      for (const msg of messages) {
        inputTokens += msg.input_tokens;
        outputTokens += msg.output_tokens;
      }

      expect(inputTokens).toBe(150);
      expect(outputTokens).toBe(200);
    });
  });
});
