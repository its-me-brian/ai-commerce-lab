// Cost Budget Tracker Tests
import { describe, it, expect, beforeEach } from "vitest";
import {
  CostBudgetTracker,
  resetCostBudgetTracker,
  createAgentBudget,
  createWorkflowBudget,
  createGlobalDailyBudget,
} from "./cost-budget";
import type { CostBudget }from "./cost-budget";

describe("CostBudgetTracker", () => {
  let tracker: CostBudgetTracker;

  beforeEach(() => {
    resetCostBudgetTracker();
    tracker = new CostBudgetTracker();
  });

  // ============================================
  // BUDGET MANAGEMENT
  // ============================================

  describe("budget management", () => {
    it("adds and retrieves a budget", () => {
      const budget: CostBudget = {
        id: "agent:researcher:day",
        workspaceId: "test-ws",
        entityId: "researcher",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      };

      tracker.setBudget(budget);
      const retrieved = tracker.getBudget("agent:researcher:day");
      expect(retrieved).toEqual(budget);
    });

    it("removes a budget", () => {
      tracker.setBudget({
        id: "test-budget",
        workspaceId: "test-ws",
        entityId: "test",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });

      tracker.removeBudget("test-budget");
      expect(tracker.getBudget("test-budget")).toBeUndefined();
    });

    it("lists budgets for an entity", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });
      tracker.setBudget({
        id: "agent:a:hour",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 0.1,
        window: "hour",
        active: true,
      });
      tracker.setBudget({
        id: "agent:b:day",
        workspaceId: "test-ws",
        entityId: "b",
        entityType: "agent",
        maxDollars: 2.0,
        window: "day",
        active: true,
      });

      const budgets = tracker.getBudgetsForEntity("a");
      expect(budgets).toHaveLength(2);
    });

    it("filters by entity type", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });
      tracker.setBudget({
        id: "workflow:a:total",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "workflow",
        maxDollars: 5.0,
        window: "total",
        active: true,
      });

      const agentBudgets = tracker.getBudgetsForEntity("a", "agent");
      expect(agentBudgets).toHaveLength(1);
      expect(agentBudgets[0].entityType).toBe("agent");
    });

    it("returns only active budgets", () => {
      tracker.setBudget({
        id: "active-budget",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });
      tracker.setBudget({
        id: "inactive-budget",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: false,
      });

      const active = tracker.getActiveBudgets();
      expect(active).toHaveLength(1);
      expect(active[0].id).toBe("active-budget");
    });
  });

  // ============================================
  // PRE-FLIGHT CHECKS
  // ============================================

  describe("checkBudget", () => {
    it("allows when no budget exists", () => {
      const result = tracker.checkBudget("agent-a", "agent", 0.5);
      expect(result.allowed).toBe(true);
    });

    it("allows when within budget", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });

      const result = tracker.checkBudget("a", "agent", 0.5);
      expect(result.allowed).toBe(true);
    });

    it("rejects when estimated cost exceeds budget", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 0.1,
        window: "day",
        active: true,
      });

      const result = tracker.checkBudget("a", "agent", 0.5);
      expect(result.allowed).toBe(false);
      if (!result.allowed) {
        expect(result.violatedBudget.budget.entityId).toBe("a");
      }
    });

    it("rejects when existing spending + estimated would exceed budget", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });

      // Record existing spending
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars:  0.8, workspaceId: "test-ws" });

      // Check if we can spend 0.3 more → total 1.1 > 1.0
      const result = tracker.checkBudget("a", "agent", 0.3);
      expect(result.allowed).toBe(false);
    });

    it("checks global budget as well", () => {
      tracker.setBudget({
        id: "global:global:day",
        workspaceId: "test-ws",
        entityId: "global",
        entityType: "global",
        maxDollars: 5.0,
        window: "day",
        active: true,
      });

      // Spending on specific agent
      tracker.recordCost({ entityId: "agent-a", entityType: "agent", costDollars:  4.8, workspaceId: "test-ws" });

      // Global check: 4.8 + 0.5 = 5.3 > 5.0
      const result = tracker.checkBudget("agent-a", "agent", 0.5);
      expect(result.allowed).toBe(false);
    });

    it("assertBudget throws on violation", () => {
      tracker.setBudget({
        id: "agent:a:day",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 0.1,
        window: "day",
        active: true,
      });

      expect(() => tracker.assertBudget("a", "agent", 0.5)).toThrow("Budget exceeded");
    });
  });

  // ============================================
  // COST RECORDING
  // ============================================

  describe("recordCost", () => {
    it("records a cost", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.1, workspaceId: "test-ws" });

      const spending = tracker.getSpending("a", "agent", "total");
      expect(spending).toBe(0.1);
    });

    it("accumulates multiple costs", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.1, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.2, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.3, workspaceId: "test-ws" });

      const spending = tracker.getSpending("a", "agent", "total");
      expect(spending).toBeCloseTo(0.6);
    });

    it("emits alert when crossing threshold", () => {
      tracker.setBudget({
        id: "agent:a:day",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
        alertThresholds: [0.5, 0.9],
      });

      // Spend 0.55 → crosses 50% threshold
      const alerts = tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.55, workspaceId: "test-ws" });
      expect(alerts.length).toBeGreaterThan(0);
      expect(alerts[0].level).toBe("warning");
    });

    it("emits critical alert near limit", () => {
      tracker.setBudget({
        id: "agent:a:day",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
        alertThresholds: [0.8, 0.95],
      });

      const alerts = tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.96, workspaceId: "test-ws" });
      const critical = alerts.find((a) => a.level === "critical");
      expect(critical).toBeDefined();
    });

    it("emits exceeded alert when over limit", () => {
      tracker.setBudget({
        id: "agent:a:day",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
        alertThresholds: [0.8],
      });

      const alerts = tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 1.1, workspaceId: "test-ws" });
      const exceeded = alerts.find((a) => a.level === "exceeded");
      expect(exceeded).toBeDefined();
    });

    it("does not duplicate alerts", () => {
      tracker.setBudget({
        id: "agent:a:day",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
        alertThresholds: [0.5],
      });

      // First spend crosses threshold
      const alerts1 = tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.55, workspaceId: "test-ws" });
      expect(alerts1.length).toBe(1);

      // Second spend still in same range → no new alert
      const alerts2 = tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.1, workspaceId: "test-ws" });
      expect(alerts2.length).toBe(0);
    });
  });

  // ============================================
  // SPENDING QUERIES
  // ============================================

  describe("spending queries", () => {
    it("getSpending returns 0 for no records", () => {
      expect(tracker.getSpending("a", "agent", "day")).toBe(0);
    });

    it("getSpending isolates by entity", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.5, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "b", entityType: "agent", costDollars: 0.3, workspaceId: "test-ws" });

      expect(tracker.getSpending("a", "agent", "total")).toBe(0.5);
      expect(tracker.getSpending("b", "agent", "total")).toBe(0.3);
    });

    it("getSpending isolates by entity type", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.5, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "a", entityType: "workflow", costDollars: 0.3, workspaceId: "test-ws" });

      expect(tracker.getSpending("a", "agent", "total")).toBe(0.5);
      expect(tracker.getSpending("a", "workflow", "total")).toBe(0.3);
    });

    it("getTotalSpending sums all records", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.5, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "b", entityType: "workflow", costDollars: 0.3, workspaceId: "test-ws" });

      expect(tracker.getTotalSpending("total")).toBeCloseTo(0.8);
    });
  });

  // ============================================
  // BUDGET STATUS
  // ============================================

  describe("getBudgetStatus", () => {
    it("returns correct status with no spending", () => {
      const budget: CostBudget = {
        id: "test",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      };

      const status = tracker.getBudgetStatus(budget);
      expect(status.currentSpending).toBe(0);
      expect(status.remainingDollars).toBe(1.0);
      expect(status.utilizationPercent).toBe(0);
      expect(status.exhausted).toBe(false);
    });

    it("returns correct status with spending", () => {
      const budget: CostBudget = {
        id: "test",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 1.0,
        window: "day",
        active: true,
      };

      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.6, workspaceId: "test-ws" });

      const status = tracker.getBudgetStatus(budget);
      expect(status.currentSpending).toBeCloseTo(0.6);
      expect(status.remainingDollars).toBeCloseTo(0.4);
      expect(status.utilizationPercent).toBeCloseTo(0.6);
      expect(status.exhausted).toBe(false);
    });

    it("marks as exhausted when over limit", () => {
      const budget: CostBudget = {
        id: "test",
        workspaceId: "test-ws",
        entityId: "a",
        entityType: "agent",
        maxDollars: 0.5,
        window: "day",
        active: true,
      };

      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.6, workspaceId: "test-ws" });

      const status = tracker.getBudgetStatus(budget);
      expect(status.exhausted).toBe(true);
    });

    it("getEntityStatus returns all budgets for entity", () => {
      tracker.setBudget({
        id: "a:day",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });
      tracker.setBudget({
        id: "a:hour",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 0.1,
        window: "hour",
        active: true,
      });

      const statuses = tracker.getEntityStatus("a", "agent");
      expect(statuses).toHaveLength(2);
    });
  });

  // ============================================
  // CONVENIENCE HELPERS
  // ============================================

  describe("convenience helpers", () => {
    it("createAgentBudget creates a day budget", () => {
      const budget = createAgentBudget("researcher", 2.0, { description: "Test" });
      expect(budget.entityType).toBe("agent");
      expect(budget.window).toBe("day");
      expect(budget.maxDollars).toBe(2.0);
      expect(budget.description).toBe("Test");
    });

    it("createWorkflowBudget creates a total budget", () => {
      const budget = createWorkflowBudget("product-search", 0.5);
      expect(budget.entityType).toBe("workflow");
      expect(budget.window).toBe("total");
      expect(budget.maxDollars).toBe(0.5);
    });

    it("createGlobalDailyBudget creates global day budget", () => {
      const budget = createGlobalDailyBudget(10.0);
      expect(budget.entityType).toBe("global");
      expect(budget.window).toBe("day");
      expect(budget.maxDollars).toBe(10.0);
      expect(budget.entityId).toBe("global");
    });
  });

  // ============================================
  // CLEAR
  // ============================================

  describe("clear", () => {
    it("resets everything", () => {
      tracker.setBudget({
        id: "test",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 1.0,
        window: "day",
        active: true,
      });
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.5, workspaceId: "test-ws" });

      tracker.clear();

      expect(tracker.getAllBudgets()).toHaveLength(0);
      expect(tracker.getRecentRecords()).toHaveLength(0);
      expect(tracker.getAlerts()).toHaveLength(0);
    });

    it("clearAlerts removes alerts for a specific budget", () => {
      tracker.setBudget({
        id: "budget-a",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 0.5,
        window: "day",
        active: true,
        alertThresholds: [0.5],
      });
      tracker.setBudget({
        id: "budget-b",
        entityId: "b",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 0.5,
        window: "day",
        active: true,
        alertThresholds: [0.5],
      });

      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.3, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "b", entityType: "agent", costDollars: 0.3, workspaceId: "test-ws" });

      expect(tracker.getAlerts()).toHaveLength(2);
      tracker.clearAlerts("budget-a");
      expect(tracker.getAlerts()).toHaveLength(1);
    });
  });

  // ============================================
  // EDGE CASES
  // ============================================

  describe("edge cases", () => {
    it("handles zero-cost execution", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0, workspaceId: "test-ws" });
      expect(tracker.getSpending("a", "agent", "total")).toBe(0);
    });

    it("handles very small costs", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.0001, workspaceId: "test-ws" });
      expect(tracker.getSpending("a", "agent", "total")).toBeCloseTo(0.0001);
    });

    it("handles budget with zero limit (always exhausted)", () => {
      tracker.setBudget({
        id: "zero-budget",
        entityId: "a",
        entityType: "agent",
        workspaceId: "test-ws",
        maxDollars: 0,
        window: "day",
        active: true,
      });

      const result = tracker.checkBudget("a", "agent", 0.001);
      expect(result.allowed).toBe(false);
    });

    it("recent records are ordered chronologically", () => {
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.1, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.2, workspaceId: "test-ws" });
      tracker.recordCost({ entityId: "a", entityType: "agent", costDollars: 0.3, workspaceId: "test-ws" });

      const records = tracker.getRecentRecords();
      expect(records[0].costDollars).toBe(0.1);
      expect(records[2].costDollars).toBe(0.3);
    });
  });
});
