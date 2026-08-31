// Routing Policies Tests

import { describe, it, expect } from "vitest";
import { selectRoute, explainSelection } from "./routing-policies";
import type { AgentModelRoute } from "./agent-model-routes";
import type { ModelRecord } from "./model-registry";
import type { RouterExecutionLog } from "./router";

const baseRoute: Omit<AgentModelRoute, "id" | "model_id" | "priority"> = {
  agent_id: "test-agent",
  policy: "priority",
  enabled: true,
  created_at: "2026-08-31T00:00:00Z",
  updated_at: "2026-08-31T00:00:00Z",
};

function makeRoute(
  id: string,
  modelId: string,
  priority: number
): AgentModelRoute {
  return { ...baseRoute, id, model_id: modelId, priority };
}

function makeModel(
  id: string,
  inputPrice: number,
  outputPrice: number
): ModelRecord {
  return {
    id,
    provider_id: "test",
    name: `Model ${id}`,
    model_id: id,
    enabled: true,
    context_window: 200000,
    input_price: inputPrice,
    output_price: outputPrice,
    capabilities: [],
    created_at: "2026-08-31T00:00:00Z",
    updated_at: "2026-08-31T00:00:00Z",
  };
}

function makeLog(
  model: string,
  durationMs: number,
  success = true
): RouterExecutionLog {
  return {
    agentId: "test-agent",
    provider: "test",
    model,
    inputTokens: 100,
    outputTokens: 50,
    durationMs,
    success,
    usedFallback: false,
    timestamp: new Date(),
  };
}

describe("Routing Policies", () => {
  describe("selectRoute", () => {
    it("should return null for empty routes", () => {
      const result = selectRoute([], new Map(), "priority");
      expect(result).toBeNull();
    });

    describe("priority policy", () => {
      it("should select route with lowest priority number", () => {
        const routes = [
          makeRoute("r1", "model-a", 2),
          makeRoute("r2", "model-b", 0),
          makeRoute("r3", "model-c", 1),
        ];

        const result = selectRoute(routes, new Map(), "priority");
        expect(result!.id).toBe("r2");
      });

      it("should select single route", () => {
        const routes = [makeRoute("r1", "model-a", 0)];

        const result = selectRoute(routes, new Map(), "priority");
        expect(result!.id).toBe("r1");
      });
    });

    describe("cheapest policy", () => {
      it("should select model with lowest total cost", () => {
        const routes = [
          makeRoute("r1", "model-a", 0),
          makeRoute("r2", "model-b", 0),
          makeRoute("r3", "model-c", 0),
        ];

        const models = new Map([
          ["model-a", makeModel("model-a", 3.0, 15.0)],
          ["model-b", makeModel("model-b", 0.8, 4.0)],
          ["model-c", makeModel("model-c", 0, 0)],
        ]);

        const result = selectRoute(routes, models, "cheapest");
        expect(result!.id).toBe("r3"); // Free model
      });

      it("should prefer free models", () => {
        const routes = [
          makeRoute("r1", "model-a", 0),
          makeRoute("r2", "model-b", 0),
        ];

        const models = new Map([
          ["model-a", makeModel("model-a", 0, 0)],
          ["model-b", makeModel("model-b", 1.0, 2.0)],
        ]);

        const result = selectRoute(routes, models, "cheapest");
        expect(result!.id).toBe("r1");
      });

      it("should handle missing model data", () => {
        const routes = [
          makeRoute("r1", "model-a", 0),
          makeRoute("r2", "model-b", 0),
        ];

        const models = new Map([
          ["model-a", makeModel("model-a", 1.0, 2.0)],
          // model-b not in map
        ]);

        const result = selectRoute(routes, models, "cheapest");
        expect(result!.id).toBe("r1"); // model-a has known cost, model-b is Infinity
      });
    });

    describe("fastest policy", () => {
      it("should select model with lowest average latency", () => {
        const routes = [
          makeRoute("r1", "model-a", 0),
          makeRoute("r2", "model-b", 0),
        ];

        const models = new Map([
          ["model-a", makeModel("model-a", 0, 0)],
          ["model-b", makeModel("model-b", 0, 0)],
        ]);

        const logs = [
          makeLog("model-a", 300),
          makeLog("model-a", 200),
          makeLog("model-b", 100),
          makeLog("model-b", 150),
        ];

        const result = selectRoute(routes, models, "fastest", logs);
        expect(result!.id).toBe("r2"); // avg 125ms vs 250ms
      });

      it("should ignore failed executions", () => {
        const routes = [
          makeRoute("r1", "model-a", 0),
          makeRoute("r2", "model-b", 0),
        ];

        const models = new Map([
          ["model-a", makeModel("model-a", 0, 0)],
          ["model-b", makeModel("model-b", 0, 0)],
        ]);

        const logs = [
          makeLog("model-a", 300, true),
          makeLog("model-a", 5000, false), // Failed — should be ignored
          makeLog("model-b", 200, true),
        ];

        const result = selectRoute(routes, models, "fastest", logs);
        expect(result!.id).toBe("r2"); // avg 200ms vs 300ms
      });

      it("should fallback to priority when no logs available", () => {
        const routes = [
          makeRoute("r1", "model-a", 2),
          makeRoute("r2", "model-b", 0),
        ];

        const result = selectRoute(routes, new Map(), "fastest");
        expect(result!.id).toBe("r2"); // Lowest priority
      });

      it("should fallback to priority when no successful logs", () => {
        const routes = [
          makeRoute("r1", "model-a", 1),
          makeRoute("r2", "model-b", 0),
        ];

        const logs = [makeLog("model-a", 100, false)];

        const result = selectRoute(routes, new Map(), "fastest", logs);
        expect(result!.id).toBe("r2"); // Fallback to priority
      });
    });

    describe("unknown policy", () => {
      it("should fallback to priority", () => {
        const routes = [
          makeRoute("r1", "model-a", 2),
          makeRoute("r2", "model-b", 0),
        ];

        const result = selectRoute(routes, new Map(), "unknown" as never);
        expect(result!.id).toBe("r2");
      });
    });
  });

  describe("explainSelection", () => {
    it("should explain priority selection", () => {
      const route = makeRoute("r1", "model-a", 0);
      const explanation = explainSelection(route, "priority", new Map());
      expect(explanation).toContain("priority");
      expect(explanation).toContain("0");
    });

    it("should explain cheapest selection with cost", () => {
      const route = makeRoute("r1", "model-a", 0);
      const models = new Map([
        ["model-a", makeModel("model-a", 1.5, 3.0)],
      ]);

      const explanation = explainSelection(route, "cheapest", models);
      expect(explanation).toContain("cheapest");
      expect(explanation).toContain("$1.5");
    });

    it("should explain fastest selection with latency", () => {
      const route = makeRoute("r1", "model-a", 0);
      const models = new Map([["model-a", makeModel("model-a", 0, 0)]]);
      const logs = [makeLog("model-a", 150), makeLog("model-a", 250)];

      const explanation = explainSelection(
        route,
        "fastest",
        models,
        logs
      );
      expect(explanation).toContain("fastest");
      expect(explanation).toContain("200ms"); // avg
    });

    it("should handle fastest with no logs", () => {
      const route = makeRoute("r1", "model-a", 0);
      const explanation = explainSelection(
        route,
        "fastest",
        new Map(),
        undefined
      );
      expect(explanation).toContain("priority");
    });
  });
});
