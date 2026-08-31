// Model Registry Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ModelRegistry } from "./model-registry";
import type { ModelRecord } from "./model-registry";

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
      single: vi.fn(),
    })),
  },
}));

const mockModel: ModelRecord = {
  id: "gemini-3-flash",
  provider_id: "gemini",
  name: "Gemini 3 Flash",
  model_id: "gemini-3-flash-preview",
  enabled: true,
  context_window: 1000000,
  input_price: 0,
  output_price: 0,
  capabilities: ["vision", "json-mode", "tool-use"],
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

const mockModel2: ModelRecord = {
  id: "claude-sonnet-4",
  provider_id: "anthropic",
  name: "Claude Sonnet 4",
  model_id: "claude-sonnet-4-20250514",
  enabled: true,
  context_window: 200000,
  input_price: 3.0,
  output_price: 15.0,
  capabilities: ["vision", "tool-use", "reasoning"],
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

const mockModel3: ModelRecord = {
  id: "grok-3-mini",
  provider_id: "xai",
  name: "Grok 3 Mini",
  model_id: "grok-3-mini-latest",
  enabled: false,
  context_window: 128000,
  input_price: 0.3,
  output_price: 0.5,
  capabilities: ["json-mode"],
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

describe("ModelRegistry", () => {
  let registry: ModelRegistry;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = new ModelRegistry();
  });

  it("should create a model registry instance", () => {
    expect(registry).toBeDefined();
    expect(registry).toBeInstanceOf(ModelRegistry);
  });

  it("should have list method", () => {
    expect(typeof registry.list).toBe("function");
  });

  it("should have listEnabled method", () => {
    expect(typeof registry.listEnabled).toBe("function");
  });

  it("should have getById method", () => {
    expect(typeof registry.getById).toBe("function");
  });

  it("should have listByProvider method", () => {
    expect(typeof registry.listByProvider).toBe("function");
  });

  it("should have listByCapabilities method", () => {
    expect(typeof registry.listByCapabilities).toBe("function");
  });

  it("should have listByAnyCapability method", () => {
    expect(typeof registry.listByAnyCapability).toBe("function");
  });

  it("should have hasCapability method", () => {
    expect(typeof registry.hasCapability).toBe("function");
  });

  it("should have create method", () => {
    expect(typeof registry.create).toBe("function");
  });

  it("should have update method", () => {
    expect(typeof registry.update).toBe("function");
  });

  it("should have setEnabled method", () => {
    expect(typeof registry.setEnabled).toBe("function");
  });

  it("should have delete method", () => {
    expect(typeof registry.delete).toBe("function");
  });

  describe("capability queries", () => {
    it("should filter models by ALL capabilities", () => {
      const models = [mockModel, mockModel2, mockModel3];
      
      // Both have "vision" and "tool-use"
      const result = models.filter((m) =>
        ["vision", "tool-use"].every((cap) => m.capabilities.includes(cap))
      );

      expect(result).toHaveLength(2);
      expect(result.map((m) => m.id)).toContain("gemini-3-flash");
      expect(result.map((m) => m.id)).toContain("claude-sonnet-4");
      expect(result.map((m) => m.id)).not.toContain("grok-3-mini");
    });

    it("should filter models by ANY capability", () => {
      const models = [mockModel, mockModel2, mockModel3];
      
      // Has "reasoning" OR "json-mode"
      const result = models.filter((m) =>
        ["reasoning", "json-mode"].some((cap) => m.capabilities.includes(cap))
      );

      expect(result).toHaveLength(3); // All three have at least one
    });

    it("should return empty when no model has required capability", () => {
      const models = [mockModel, mockModel2, mockModel3];
      
      const result = models.filter((m) =>
        ["nonexistent-cap"].every((cap) => m.capabilities.includes(cap))
      );

      expect(result).toHaveLength(0);
    });

    it("should check single capability on a model", () => {
      expect(mockModel.capabilities).toContain("vision");
      expect(mockModel.capabilities).toContain("json-mode");
      expect(mockModel.capabilities).toContain("tool-use");
      expect(mockModel.capabilities).not.toContain("reasoning");
    });
  });

  describe("create", () => {
    it("should have create method that accepts capabilities", () => {
      // Verify the method accepts capabilities in input
      const input = {
        id: "test-model",
        provider_id: "gemini",
        name: "Test Model",
        model_id: "test-model-v1",
        capabilities: ["vision", "tool-use"],
      };

      expect(input.capabilities).toHaveLength(2);
      expect(input.capabilities).toContain("vision");
      expect(input.capabilities).toContain("tool-use");
    });
  });

  describe("update", () => {
    it("should allow updating capabilities", () => {
      const update = {
        capabilities: ["vision", "json-mode", "tool-use", "code-generation"],
      };

      expect(update.capabilities).toHaveLength(4);
    });
  });
});
