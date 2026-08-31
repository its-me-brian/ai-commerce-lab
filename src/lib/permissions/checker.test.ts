import { describe, it, expect, vi, beforeEach } from "vitest";
import { PermissionChecker } from "./checker";

// Mock Supabase BEFORE importing anything that uses it
const mockFrom = vi.fn();
vi.mock("../database/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

describe("PermissionChecker", () => {
  let checker: PermissionChecker;

  beforeEach(() => {
    vi.clearAllMocks();
    checker = new PermissionChecker();
  });

  describe("hasPermission", () => {
    it("should grant permission when explicit grant exists", async () => {
      // getAgentPermissions returns explicit grant
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "1",
                agent_id: "test-agent",
                action: "call_tool",
                target: "calculate_margin",
                granted: true,
                conditions: [],
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await checker.hasPermission(
        "test-agent",
        "call_tool",
        "calculate_margin"
      );

      expect(result).toBe(true);
    });

    it("should deny when explicit deny exists", async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [
              {
                id: "1",
                agent_id: "test-agent",
                action: "call_tool",
                target: "calculate_margin",
                granted: false,
                conditions: [],
              },
            ],
            error: null,
          }),
        }),
      });

      const result = await checker.hasPermission(
        "test-agent",
        "call_tool",
        "calculate_margin"
      );

      expect(result).toBe(false);
    });

    it("should fall back to role-based defaults for admin", async () => {
      // No explicit permissions
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      // Role is admin
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "admin" },
              error: null,
            }),
          }),
        }),
      });

      const result = await checker.hasPermission(
        "test-agent",
        "call_tool",
        "anything"
      );

      expect(result).toBe(true);
    });

    it("should deny for restricted role with no explicit permission", async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "restricted" },
              error: null,
            }),
          }),
        }),
      });

      const result = await checker.hasPermission(
        "test-agent",
        "call_tool",
        "anything"
      );

      expect(result).toBe(false);
    });

    it("should grant read_data for restricted role", async () => {
      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockResolvedValue({
            data: [],
            error: null,
          }),
        }),
      });

      mockFrom.mockReturnValueOnce({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "restricted" },
              error: null,
            }),
          }),
        }),
      });

      const result = await checker.hasPermission(
        "test-agent",
        "read_data",
        "anything"
      );

      expect(result).toBe(true);
    });
  });

  describe("validateExecution", () => {
    it("should allow when all permissions pass", async () => {
      vi.spyOn(checker, "hasPermission").mockResolvedValue(true);

      const result = await checker.validateExecution("test-agent", {
        tools: ["calculate_margin", "search_products"],
        provider: "gemini",
      });

      expect(result.allowed).toBe(true);
      expect(result.denied).toHaveLength(0);
    });

    it("should deny when tool permission fails", async () => {
      vi.spyOn(checker, "hasPermission").mockImplementation(
        async (_agentId, action, target) => {
          if (action === "call_tool" && target === "calculate_margin") {
            return false;
          }
          return true;
        }
      );

      const result = await checker.validateExecution("test-agent", {
        tools: ["calculate_margin", "search_products"],
        provider: "gemini",
      });

      expect(result.allowed).toBe(false);
      expect(result.denied).toContainEqual(
        "Tool access denied: calculate_margin"
      );
    });

    it("should deny when provider permission fails", async () => {
      vi.spyOn(checker, "hasPermission").mockImplementation(
        async (_agentId, action, target) => {
          if (action === "use_provider" && target === "gemini") {
            return false;
          }
          return true;
        }
      );

      const result = await checker.validateExecution("test-agent", {
        provider: "gemini",
      });

      expect(result.allowed).toBe(false);
      expect(result.denied).toContainEqual("Provider access denied: gemini");
    });

    it("should deny when agent access permission fails", async () => {
      vi.spyOn(checker, "hasPermission").mockImplementation(
        async (_agentId, action, target) => {
          if (action === "access_agent" && target === "other-agent") {
            return false;
          }
          return true;
        }
      );

      const result = await checker.validateExecution("test-agent", {
        targetAgent: "other-agent",
      });

      expect(result.allowed).toBe(false);
      expect(result.denied).toContainEqual(
        "Agent access denied: other-agent"
      );
    });

    it("should allow with empty context", async () => {
      vi.spyOn(checker, "hasPermission").mockResolvedValue(true);

      const result = await checker.validateExecution("test-agent", {});

      expect(result.allowed).toBe(true);
      expect(result.denied).toHaveLength(0);
    });
  });

  describe("getAgentRole", () => {
    it("should return agent role from database", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: "admin" },
              error: null,
            }),
          }),
        }),
      });

      const role = await checker.getAgentRole("test-agent");
      expect(role).toBe("admin");
    });

    it("should default to restricted when no role found", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: null,
              error: { code: "PGRST116" },
            }),
          }),
        }),
      });

      const role = await checker.getAgentRole("unknown-agent");
      expect(role).toBe("restricted");
    });

    it("should default to restricted when role field is null", async () => {
      mockFrom.mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { role: null },
              error: null,
            }),
          }),
        }),
      });

      const role = await checker.getAgentRole("test-agent");
      expect(role).toBe("restricted");
    });
  });
});
