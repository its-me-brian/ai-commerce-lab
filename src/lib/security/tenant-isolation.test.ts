// Tenant Isolation Tests
// Verifies that workspace-scoped service methods require workspaceId
// and that queries include workspace_id filtering.

import { describe, it, expect, vi, beforeEach } from "vitest";

// Track all Supabase query chains to verify workspace_id is present
let queryChains: string[][] = [];
let currentChain: string[] = [];

function createTrackingProxy(returnData: unknown = { id: "test", status: "pending" }) {
  const handler: ProxyHandler<Record<string, unknown>> = {
    get(_target, prop) {
      if (prop === "then") {
        return (resolve: (v: unknown) => void) => {
          queryChains.push([...currentChain]);
          currentChain = [];
          resolve({ data: returnData, error: null, count: 1 });
        };
      }
      return (...args: unknown[]) => {
        const method = prop as string;
        currentChain.push(`${method}(${args.map((a) => JSON.stringify(a)).join(", ")})`);
        // Return array-like for methods that expect array results
        if (method === "select") {
          const arrayHandler: ProxyHandler<Record<string, unknown>> = {
            get(_t, p) {
              if (p === "then") {
                return (resolve: (v: unknown) => void) => {
                  queryChains.push([...currentChain]);
                  currentChain = [];
                  resolve({ data: Array.isArray(returnData) ? returnData : [returnData], error: null, count: 1 });
                };
              }
              return (...a: unknown[]) => {
                currentChain.push(`${p as string}(${a.map((x) => JSON.stringify(x)).join(", ")})`);
                return new Proxy({}, arrayHandler);
              };
            },
          };
          return new Proxy({}, arrayHandler);
        }
        return new Proxy({}, handler);
      };
    },
  };
  return new Proxy({}, handler);
}

vi.mock("../database/supabase", () => ({
  supabase: {
    from: vi.fn(() => createTrackingProxy()),
  },
}));

describe("Tenant Isolation — workspaceId enforcement", () => {
  beforeEach(() => {
    queryChains = [];
    currentChain = [];
    vi.clearAllMocks();
  });

  describe("TaskEngine", () => {
    it("createTask requires workspaceId", async () => {
      const { TaskEngine } = await import("../ai/task-engine");
      const engine = new TaskEngine();

      await engine.create({
        agent_id: "test-agent",
        task_type: "test",
        input: {},
      }, "ws-tenant-1");

      expect(queryChains.length).toBeGreaterThan(0);
      const insertChain = queryChains.find((c) => c.some((m) => m.startsWith("insert(")));
      expect(insertChain).toBeDefined();
      expect(insertChain!.some((m) => m.includes("ws-tenant-1"))).toBe(true);
    });
  });

  describe("ApprovalManager", () => {
    it("createApproval includes workspace_id in insert", async () => {
      const { ApprovalManager } = await import("../ai/approval-manager");
      const manager = new ApprovalManager();

      await manager.createApproval({
        agent_id: "test-agent",
        action_type: "custom",
        action_summary: "test",
      }, "ws-tenant-2");

      expect(queryChains.length).toBeGreaterThan(0);
      const insertChain = queryChains.find((c) => c.some((m) => m.startsWith("insert(")));
      expect(insertChain).toBeDefined();
      expect(insertChain!.some((m) => m.includes("ws-tenant-2"))).toBe(true);
    });

    it("reviewApproval queries with workspace_id", async () => {
      const { ApprovalManager } = await import("../ai/approval-manager");
      const manager = new ApprovalManager();

      try {
        await manager.reviewApproval({
          approval_id: "ap-1",
          decision: "approved",
        }, "ws-tenant-3");
      } catch {
        // Expected to fail since no real DB — we just need to verify the query chain
      }

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains.find((c) => c.some((m) => m.startsWith("select(")));
      expect(selectChain).toBeDefined();
      // Must have .eq("workspace_id", "ws-tenant-3") in the chain
      expect(selectChain!.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-3"))).toBe(true);
    });
  });

  describe("ConversationEngine", () => {
    it("getById includes workspace_id filter", async () => {
      const { ConversationEngine } = await import("../ai/conversation-engine");
      const engine = new ConversationEngine();

      await engine.getById("conv-1", "ws-tenant-4");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-4"))).toBe(true);
    });

    it("listByAgent includes workspace_id filter", async () => {
      const { ConversationEngine } = await import("../ai/conversation-engine");
      const engine = new ConversationEngine();

      await engine.listByAgent("agent-1", "ws-tenant-5");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-5"))).toBe(true);
    });
  });

  describe("AgentMemory", () => {
    it("getById includes workspace_id filter", async () => {
      const { AgentMemoryService } = await import("../ai/agent-memory");
      const memory = new AgentMemoryService();

      await memory.getById("mem-1", "ws-tenant-6");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-6"))).toBe(true);
    });
  });

  describe("CatalogService", () => {
    it("getById includes workspace_id filter", async () => {
      const { CatalogService } = await import("../catalog/service");
      const service = new CatalogService();

      await service.getById("prod-1", "ws-tenant-7");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-7"))).toBe(true);
    });

    it("getCountsByStatus includes workspace_id filter", async () => {
      const { CatalogService } = await import("../catalog/service");
      const service = new CatalogService();

      await service.getCountsByStatus("ws-tenant-8");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-8"))).toBe(true);
    });
  });

  describe("Delegation", () => {
    it("getDelegatedTasks includes workspace_id filter", async () => {
      const { getDelegatedTasks } = await import("../ai/delegation");

      await getDelegatedTasks("task-1", "ws-tenant-9");

      expect(queryChains.length).toBeGreaterThan(0);
      const selectChain = queryChains[0];
      expect(selectChain.some((m) => m.includes("workspace_id") && m.includes("ws-tenant-9"))).toBe(true);
    });
  });
});
