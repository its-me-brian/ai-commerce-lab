// Workflow Input Resolver Tests
import { describe, it, expect } from "vitest";
import { WorkflowInputResolver } from "./input-resolver";
import type { WorkflowNodeState } from "./types";

function makeState(
  nodeId: string,
  output: Record<string, unknown>,
  status: "completed" | "pending" | "failed" = "completed"
): WorkflowNodeState {
  return {
    nodeId,
    status,
    output: status === "completed" ? output : undefined,
    retriesAttempted: 0,
  };
}

describe("WorkflowInputResolver", () => {
  describe("resolveReference", () => {
    it("resolves input references", () => {
      const resolver = new WorkflowInputResolver(new Map(), { text: "hello", nested: { key: "value" } });

      expect(resolver.resolveReference("input.text")).toBe("hello");
      expect(resolver.resolveReference("input.nested.key")).toBe("value");
    });

    it("resolves node output references", () => {
      const states = new Map([
        ["nodeA", makeState("nodeA", { bestCategory: "product", score: 0.9 })],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      expect(resolver.resolveReference("nodeA.bestCategory")).toBe("product");
      expect(resolver.resolveReference("nodeA.score")).toBe(0.9);
    });

    it("resolves entire node output", () => {
      const states = new Map([
        ["nodeA", makeState("nodeA", { foo: "bar" })],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      expect(resolver.resolveReference("nodeA.output")).toEqual({ foo: "bar" });
    });

    it("returns undefined for incomplete node", () => {
      const states = new Map([
        ["nodeA", makeState("nodeA", {}, "pending")],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      expect(resolver.resolveReference("nodeA.field")).toBeUndefined();
    });

    it("resolves literal prefix", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});

      expect(resolver.resolveReference("literal:hello world")).toBe("hello world");
    });

    it("returns literal string when no dot found", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});

      expect(resolver.resolveReference("just-a-string")).toBe("just-a-string");
    });

    it("returns undefined for empty reference", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      expect(resolver.resolveReference("")).toBeUndefined();
    });
  });

  describe("resolveNodeInput", () => {
    it("resolves input mapping for a node", () => {
      const states = new Map([
        ["classifier", makeState("classifier", { bestCategory: "marketing" })],
      ]);
      const resolver = new WorkflowInputResolver(states, { defaultText: "test" });

      const node = {
        id: "next",
        name: "Next Node",
        type: "mini-ai" as const,
        inputMapping: {
          text: "input.defaultText",
          category: "classifier.bestCategory",
        },
      };

      const resolved = resolver.resolveNodeInput(node);
      expect(resolved).toEqual({ text: "test", category: "marketing" });
    });

    it("returns empty object when no inputMapping", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      const node = { id: "n", name: "N", type: "mini-ai" as const };

      expect(resolver.resolveNodeInput(node)).toEqual({});
    });

    it("mixes input, node output, and literal references", () => {
      const states = new Map([
        ["step1", makeState("step1", { result: "done" })],
      ]);
      const resolver = new WorkflowInputResolver(states, { text: "hello" });

      const node = {
        id: "step2",
        name: "Step 2",
        type: "mini-ai" as const,
        inputMapping: {
          input: "input.text",
          prev: "step1.result",
          mode: "literal:auto",
        },
      };

      expect(resolver.resolveNodeInput(node)).toEqual({
        input: "hello",
        prev: "done",
        mode: "auto",
      });
    });
  });

  describe("resolveConditionSource", () => {
    it("resolves condition source from node output", () => {
      const states = new Map([
        ["classifier", makeState("classifier", { bestCategory: "marketing" })],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      expect(resolver.resolveConditionSource("classifier.bestCategory")).toBe("marketing");
    });

    it("resolves condition source from input", () => {
      const resolver = new WorkflowInputResolver(new Map(), { mode: "strict" });
      expect(resolver.resolveConditionSource("input.mode")).toBe("strict");
    });
  });

  describe("areDependenciesMet", () => {
    it("returns true when no inputMapping", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      expect(resolver.areDependenciesMet({ id: "n", name: "N", type: "mini-ai" as const })).toBe(true);
    });

    it("returns true when all dependency nodes are completed", () => {
      const states = new Map([
        ["a", makeState("a", {})],
        ["b", makeState("b", {})],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      const node = {
        id: "c",
        name: "C",
        type: "mini-ai" as const,
        inputMapping: { x: "a.output", y: "b.output" },
      };

      expect(resolver.areDependenciesMet(node)).toBe(true);
    });

    it("returns false when a dependency is pending", () => {
      const states = new Map([
        ["a", makeState("a", {})],
        ["b", makeState("b", {}, "pending")],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      const node = {
        id: "c",
        name: "C",
        type: "mini-ai" as const,
        inputMapping: { x: "a.output", y: "b.output" },
      };

      expect(resolver.areDependenciesMet(node)).toBe(false);
    });

    it("ignores input references for dependency check", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      const node = {
        id: "n",
        name: "N",
        type: "mini-ai" as const,
        inputMapping: { x: "input.text" },
      };

      expect(resolver.areDependenciesMet(node)).toBe(true);
    });
  });

  describe("getDependencies", () => {
    it("returns empty array when no inputMapping", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      expect(resolver.getDependencies({ id: "n", name: "N", type: "mini-ai" as const })).toEqual([]);
    });

    it("extracts node IDs from references", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      const node = {
        id: "c",
        name: "C",
        type: "mini-ai" as const,
        inputMapping: {
          x: "nodeA.output",
          y: "nodeB.field",
          z: "input.text",
          w: "literal:val",
        },
      };

      expect(resolver.getDependencies(node)).toEqual(["nodeA", "nodeB"]);
    });
  });

  describe("collectNodeOutputs", () => {
    it("collects outputs from completed nodes", () => {
      const states = new Map([
        ["a", makeState("a", { x: 1 })],
        ["b", makeState("b", { y: 2 })],
        ["c", makeState("c", {}, "pending")],
      ]);
      const resolver = new WorkflowInputResolver(states, {});

      expect(resolver.collectNodeOutputs(["a", "b", "c"])).toEqual({
        a: { x: 1 },
        b: { y: 2 },
      });
    });
  });

  describe("getNestedValue", () => {
    it("resolves nested paths", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      const obj = { a: { b: { c: 42 } } };

      expect(resolver.getNestedValue(obj, "a.b.c")).toBe(42);
      expect(resolver.getNestedValue(obj, "a.b")).toEqual({ c: 42 });
      expect(resolver.getNestedValue(obj, "a")).toEqual({ b: { c: 42 } });
    });

    it("returns undefined for missing paths", () => {
      const resolver = new WorkflowInputResolver(new Map(), {});
      expect(resolver.getNestedValue({ a: 1 }, "b")).toBeUndefined();
      expect(resolver.getNestedValue({ a: { b: 1 } }, "a.c")).toBeUndefined();
    });
  });
});
