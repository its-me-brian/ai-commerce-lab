// Agent Handoff Manager Tests
// FASE 27: Structured context-passing between agents.

import { describe, it, expect, beforeEach } from "vitest";
import { AgentHandoffManager }from "./agent-handoff";

describe("AgentHandoffManager", () => {
  let manager: AgentHandoffManager;

  beforeEach(() => {
    manager = new AgentHandoffManager();
  });

  describe("createHandoff", () => {
    it("should create a handoff with pending status", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "product-hunter",
        targetAgentId: "market-research",
        type: "request",
        action: "Research market for electronics",
        context: {
          reason: "Need market data for product discovery",
          sourceContext: { products: ["laptop", "phone"] },
        },
      });

      expect(handoff.id).toBe("ho-1");
      expect(handoff.sourceAgentId).toBe("product-hunter");
      expect(handoff.targetAgentId).toBe("market-research");
      expect(handoff.type).toBe("request");
      expect(handoff.status).toBe("pending");
      expect(handoff.context.reason).toBe("Need market data for product discovery");
    });

    it("should create transfer handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "ceo",
        targetAgentId: "product-hunter",
        type: "transfer",
        action: "Execute full product discovery pipeline",
        context: {
          reason: "CEO delegating complete workflow",
          sourceContext: { workspace: "ws-1" },
          partialResults: { strategy: "electronics" },
          expectedOutput: "List of 10 viable products",
        },
      });

      expect(handoff.type).toBe("transfer");
      expect(handoff.context.partialResults).toEqual({ strategy: "electronics" });
      expect(handoff.context.expectedOutput).toBe("List of 10 viable products");
    });

    it("should increment IDs", () => {
      const h1 = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      const h2 = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      expect(h1.id).toBe("ho-1");
      expect(h2.id).toBe("ho-2");
    });
  });

  describe("startHandoff", () => {
    it("should transition pending to in_progress", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const started = manager.startHandoff(handoff.id);
      expect(started?.status).toBe("in_progress");
    });

    it("should return undefined for non-existent handoff", () => {
      expect(manager.startHandoff("ho-999")).toBeUndefined();
    });

    it("should return undefined for non-pending handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.startHandoff(handoff.id);

      // Try starting again
      expect(manager.startHandoff(handoff.id)).toBeUndefined();
    });
  });

  describe("completeHandoff", () => {
    it("should complete a handoff with results", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const completed = manager.completeHandoff({
        handoffId: handoff.id,
        result: {
          success: true,
          data: { marketSize: 1000000 },
          summary: "Market research complete",
        },
      });

      expect(completed?.status).toBe("completed");
      expect(completed?.result?.success).toBe(true);
      expect(completed?.result?.data).toEqual({ marketSize: 1000000 });
      expect(completed?.completedAt).toBeDefined();
    });

    it("should mark as failed when result is not successful", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const completed = manager.completeHandoff({
        handoffId: handoff.id,
        result: {
          success: false,
          data: {},
          summary: "Failed to get data",
          errors: ["API timeout"],
        },
      });

      expect(completed?.status).toBe("failed");
    });

    it("should return undefined for invalid status transition", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.completeHandoff({
        handoffId: handoff.id,
        result: { success: true, data: {}, summary: "done" },
      });

      // Try completing again
      const result = manager.completeHandoff({
        handoffId: handoff.id,
        result: { success: true, data: {}, summary: "again" },
      });
      expect(result).toBeUndefined();
    });
  });

  describe("returnHandoff", () => {
    it("should return results to source agent", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.completeHandoff({
        handoffId: handoff.id,
        result: { success: true, data: { x: 1 }, summary: "done" },
      });

      const returned = manager.returnHandoff(handoff.id, {
        success: true,
        data: { x: 1, extra: true },
        summary: "Returning results",
      });

      expect(returned?.status).toBe("returned");
    });

    it("should return undefined for non-completed handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      expect(manager.returnHandoff(handoff.id, {
        success: true,
        data: {},
        summary: "test",
      })).toBeUndefined();
    });
  });

  describe("getHandoffsByAgent", () => {
    it("should find handoffs where agent is source", () => {
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const handoffs = manager.getHandoffsByAgent("a");
      expect(handoffs.length).toBe(1);
      expect(handoffs[0].sourceAgentId).toBe("a");
    });

    it("should find handoffs where agent is target", () => {
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const handoffs = manager.getHandoffsByAgent("b");
      expect(handoffs.length).toBe(1);
      expect(handoffs[0].targetAgentId).toBe("b");
    });

    it("should return empty for agent with no handoffs", () => {
      expect(manager.getHandoffsByAgent("unknown")).toEqual([]);
    });
  });

  describe("getPendingHandoffs", () => {
    it("should return only pending handoffs for target agent", () => {
      const h1 = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test 1",
        context: { reason: "test", sourceContext: {} },
      });
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test 2",
        context: { reason: "test", sourceContext: {} },
      });
      manager.startHandoff(h1.id);

      const pending = manager.getPendingHandoffs("b");
      expect(pending.length).toBe(1);
      expect(pending[0].id).toBe(h1.id === "ho-1" ? "ho-2" : "ho-1");
    });
  });

  describe("buildContextForTarget", () => {
    it("should build context object for target agent", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "product-hunter",
        targetAgentId: "market-research",
        type: "request",
        action: "Research electronics market",
        context: {
          reason: "Need market data",
          sourceContext: { products: ["laptop"], budget: 5000 },
          expectedOutput: "Market size and competitors",
        },
      });

      const context = manager.buildContextForTarget(handoff.id);
      expect(context).toBeDefined();
      const handoffInfo = context?._handoff as Record<string, unknown>;
      expect(handoffInfo).toBeDefined();
      expect(handoffInfo.from).toBe("product-hunter");
      expect(handoffInfo.action).toBe("Research electronics market");
      expect(context?.products).toEqual(["laptop"]);
      expect(context?.budget).toBe(5000);
      expect(context?._expectedOutput).toBe("Market size and competitors");
    });

    it("should include partial results if present", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "transfer",
        action: "continue work",
        context: {
          reason: "transferring",
          sourceContext: { workspace: "ws-1" },
          partialResults: { step1: "done" },
        },
      });

      const context = manager.buildContextForTarget(handoff.id);
      expect(context?._partialResults).toEqual({ step1: "done" });
    });

    it("should return undefined for non-existent handoff", () => {
      expect(manager.buildContextForTarget("ho-999")).toBeUndefined();
    });
  });

  describe("buildContextForSource", () => {
    it("should build context for source when receiving results", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "get data",
        context: {
          reason: "need info",
          sourceContext: { query: "electronics" },
        },
      });
      manager.completeHandoff({
        handoffId: handoff.id,
        result: {
          success: true,
          data: { marketSize: 500000 },
          summary: "Research complete",
        },
      });

      const context = manager.buildContextForSource(handoff.id);
      expect(context).toBeDefined();
      const resultInfo = context?._handoffResult as Record<string, unknown>;
      expect(resultInfo).toBeDefined();
      expect(resultInfo.from).toBe("b");
      expect(context?.marketSize).toBe(500000);
      expect(context?.query).toBe("electronics");
    });

    it("should return undefined for handoff without results", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      expect(manager.buildContextForSource(handoff.id)).toBeUndefined();
    });
  });

  describe("getStats", () => {
    it("should track stats correctly", () => {
      const h1 = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "c",
        type: "transfer",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.completeHandoff({
        handoffId: h1.id,
        result: { success: true, data: {}, summary: "done" },
      });

      const stats = manager.getStats();
      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.pending).toBe(1);
      expect(stats.byType.request).toBe(1);
      expect(stats.byType.transfer).toBe(1);
    });
  });

  describe("cancelHandoff", () => {
    it("should cancel a pending handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const cancelled = manager.cancelHandoff(handoff.id);
      expect(cancelled).toBe(true);

      const h = manager.getHandoff(handoff.id);
      expect(h?.status).toBe("failed");
      expect(h?.result?.summary).toBe("Handoff cancelled by source agent");
    });

    it("should return false for non-pending handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.startHandoff(handoff.id);

      expect(manager.cancelHandoff(handoff.id)).toBe(false);
    });
  });

  describe("getOverdueHandoffs", () => {
    it("should find overdue handoffs", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "urgent task",
        context: {
          reason: "deadline",
          sourceContext: {},
          deadline: new Date(Date.now() - 1000).toISOString(), // 1 second ago
        },
      });

      const overdue = manager.getOverdueHandoffs("b");
      expect(overdue.length).toBe(1);
      expect(overdue[0].id).toBe(handoff.id);
    });

    it("should not include non-overdue handoffs", () => {
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: {
          reason: "test",
          sourceContext: {},
          deadline: new Date(Date.now() + 3600000).toISOString(), // 1 hour from now
        },
      });

      const overdue = manager.getOverdueHandoffs("b");
      expect(overdue.length).toBe(0);
    });
  });

  describe("getHandoffChain", () => {
    it("should trace a single handoff", () => {
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const chain = manager.getHandoffChain(handoff.id);
      expect(chain.length).toBe(1);
      expect(chain[0].id).toBe(handoff.id);
    });

    it("should trace a chain with return", () => {
      // Create request handoff
      const handoff = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "get data",
        context: { reason: "need info", sourceContext: {} },
      });
      manager.completeHandoff({
        handoffId: handoff.id,
        result: { success: true, data: {}, summary: "done" },
      });

      // Create return handoff
      manager.createHandoff({
        sourceAgentId: "b",
        targetAgentId: "a",
        type: "return",
        action: "return results",
        context: {
          reason: "completing request",
          sourceContext: { _originalHandoffId: handoff.id },
        },
      });

      const chain = manager.getHandoffChain(handoff.id);
      expect(chain.length).toBe(2);
    });
  });

  describe("getOutgoingHandoffs", () => {
    it("should return only handoffs initiated by agent", () => {
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.createHandoff({
        sourceAgentId: "c",
        targetAgentId: "a",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const outgoing = manager.getOutgoingHandoffs("a");
      expect(outgoing.length).toBe(1);
      expect(outgoing[0].sourceAgentId).toBe("a");
    });
  });

  describe("getIncomingHandoffs", () => {
    it("should return only handoffs received by agent", () => {
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.createHandoff({
        sourceAgentId: "c",
        targetAgentId: "a",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const incoming = manager.getIncomingHandoffs("a");
      expect(incoming.length).toBe(1);
      expect(incoming[0].targetAgentId).toBe("a");
    });
  });

  describe("getCompletedHandoffs", () => {
    it("should return completed and returned handoffs", () => {
      const h1 = manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });
      manager.completeHandoff({
        handoffId: h1.id,
        result: { success: true, data: {}, summary: "done" },
      });
      manager.createHandoff({
        sourceAgentId: "a",
        targetAgentId: "b",
        type: "request",
        action: "test",
        context: { reason: "test", sourceContext: {} },
      });

      const completed = manager.getCompletedHandoffs("a");
      expect(completed.length).toBe(1);
    });
  });
});
