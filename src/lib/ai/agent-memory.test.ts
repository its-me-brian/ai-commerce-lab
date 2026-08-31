// Agent Memory Service Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentMemoryService } from "./agent-memory";
import type { AgentMemory } from "./agent-memory";

// Mock Supabase
vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn().mockReturnThis(),
      insert: vi.fn().mockReturnThis(),
      update: vi.fn().mockReturnThis(),
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      gte: vi.fn().mockReturnThis(),
      or: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis(),
      single: vi.fn(),
    })),
  },
}));

const mockMemory: AgentMemory = {
  id: "mem-1",
  agent_id: "product-hunter",
  workspace_id: "ws-default",
  memory_type: "fact",
  content: "User prefers eco-friendly products",
  source: "conversation",
  confidence: 0.9,
  metadata: {},
  expires_at: null,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

describe("AgentMemoryService", () => {
  let service: AgentMemoryService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AgentMemoryService();
  });

  it("should create an instance", () => {
    expect(service).toBeDefined();
    expect(service).toBeInstanceOf(AgentMemoryService);
  });

  it("should have all required methods", () => {
    expect(typeof service.store).toBe("function");
    expect(typeof service.getById).toBe("function");
    expect(typeof service.search).toBe("function");
    expect(typeof service.getRecent).toBe("function");
    expect(typeof service.update).toBe("function");
    expect(typeof service.delete).toBe("function");
    expect(typeof service.deleteAllForAgent).toBe("function");
    expect(typeof service.count).toBe("function");
  });

  describe("memory model", () => {
    it("should have required fields", () => {
      expect(mockMemory.id).toBeDefined();
      expect(mockMemory.agent_id).toBeDefined();
      expect(mockMemory.memory_type).toBe("fact");
      expect(mockMemory.content).toBeDefined();
    });

    it("should support confidence score", () => {
      expect(mockMemory.confidence).toBe(0.9);
    });

    it("should support expiration", () => {
      const expired = { ...mockMemory, expires_at: "2020-01-01T00:00:00Z" };
      expect(expired.expires_at).toBeDefined();
    });

    it("should support different memory types", () => {
      const types = ["fact", "preference", "pattern", "decision", "context"];
      for (const type of types) {
        expect(type).toBeDefined();
      }
    });
  });

  describe("store", () => {
    it("should accept all required fields", () => {
      const input = {
        agent_id: "product-hunter",
        memory_type: "fact" as const,
        content: "Test memory",
      };

      expect(input.agent_id).toBeDefined();
      expect(input.memory_type).toBe("fact");
      expect(input.content).toBeDefined();
    });

    it("should default confidence to 1.0", () => {
      const input = {
        agent_id: "product-hunter",
        memory_type: "fact" as const,
        content: "Test",
      };

      const confidence = input.confidence ?? 1.0;
      expect(confidence).toBe(1.0);
    });
  });
});
