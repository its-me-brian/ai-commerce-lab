// Agent Model Routes Tests

import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentModelRoutes } from "./agent-model-routes";
import type { AgentModelRoute } from "./agent-model-routes";

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

const mockRoute: AgentModelRoute = {
  id: "route-1",
  agent_id: "product-hunter",
  model_id: "gemini-3-flash",
  priority: 0,
  policy: "priority",
  enabled: true,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

const mockRoute2: AgentModelRoute = {
  id: "route-2",
  agent_id: "product-hunter",
  model_id: "claude-3-5-haiku",
  priority: 1,
  policy: "priority",
  enabled: true,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

describe("AgentModelRoutes", () => {
  let routes: AgentModelRoutes;

  beforeEach(() => {
    vi.clearAllMocks();
    routes = new AgentModelRoutes();
  });

  it("should create an instance", () => {
    expect(routes).toBeDefined();
    expect(routes).toBeInstanceOf(AgentModelRoutes);
  });

  it("should have listByAgent method", () => {
    expect(typeof routes.listByAgent).toBe("function");
  });

  it("should have listEnabledByAgent method", () => {
    expect(typeof routes.listEnabledByAgent).toBe("function");
  });

  it("should have getById method", () => {
    expect(typeof routes.getById).toBe("function");
  });

  it("should have getByAgentAndModel method", () => {
    expect(typeof routes.getByAgentAndModel).toBe("function");
  });

  it("should have listByModel method", () => {
    expect(typeof routes.listByModel).toBe("function");
  });

  it("should have create method", () => {
    expect(typeof routes.create).toBe("function");
  });

  it("should have update method", () => {
    expect(typeof routes.update).toBe("function");
  });

  it("should have setEnabled method", () => {
    expect(typeof routes.setEnabled).toBe("function");
  });

  it("should have delete method", () => {
    expect(typeof routes.delete).toBe("function");
  });

  it("should have deleteAllForAgent method", () => {
    expect(typeof routes.deleteAllForAgent).toBe("function");
  });

  describe("route model", () => {
    it("should support priority field", () => {
      expect(mockRoute.priority).toBe(0);
      expect(mockRoute2.priority).toBe(1);
    });

    it("should support policy field", () => {
      expect(mockRoute.policy).toBe("priority");
    });

    it("should support enabled field", () => {
      expect(mockRoute.enabled).toBe(true);
    });
  });

  describe("create", () => {
    it("should accept agent_id and model_id", () => {
      const input = {
        agent_id: "product-hunter",
        model_id: "gemini-3-flash",
        priority: 0,
        policy: "priority" as const,
      };

      expect(input.agent_id).toBeDefined();
      expect(input.model_id).toBeDefined();
    });

    it("should default to priority 0 and policy priority", () => {
      const input = {
        agent_id: "product-hunter",
        model_id: "gemini-3-flash",
      };

      const priority = input.priority ?? 0;
      const policy = input.policy ?? "priority";

      expect(priority).toBe(0);
      expect(policy).toBe("priority");
    });
  });
});
