import { describe, it, expect } from "vitest";
import { ToolRegistry } from "./registry";
import type { Tool, ToolResult } from "./types";

// Mock tool for testing
class MockTool implements Tool {
  readonly id = "mock-tool";
  readonly name = "Mock Tool";
  readonly description = "A tool for testing";
  readonly inputSchema = { type: "object" as const };
  readonly outputSchema = { type: "object" as const };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    return {
      success: true,
      output: { message: "executed", input },
    };
  }
}

class FailingTool implements Tool {
  readonly id = "failing-tool";
  readonly name = "Failing Tool";
  readonly description = "A tool that always fails";
  readonly inputSchema = { type: "object" as const };
  readonly outputSchema = { type: "object" as const };

  async execute(): Promise<ToolResult> {
    throw new Error("Tool execution failed");
  }
}

describe("ToolRegistry", () => {
  it("should register and retrieve a tool", () => {
    const registry = new ToolRegistry();
    const tool = new MockTool();

    registry.register(tool);
    const retrieved = registry.get("mock-tool");

    expect(retrieved).toBe(tool);
  });

  it("should return undefined for unknown tool", () => {
    const registry = new ToolRegistry();
    const retrieved = registry.get("unknown");

    expect(retrieved).toBeUndefined();
  });

  it("should list all registered tools", () => {
    const registry = new ToolRegistry();
    registry.register(new MockTool());

    const tools = registry.list();

    expect(tools).toHaveLength(1);
    expect(tools[0].id).toBe("mock-tool");
  });

  it("should check if tool exists", () => {
    const registry = new ToolRegistry();
    registry.register(new MockTool());

    expect(registry.has("mock-tool")).toBe(true);
    expect(registry.has("unknown")).toBe(false);
  });

  it("should execute a tool", async () => {
    const registry = new ToolRegistry();
    registry.register(new MockTool());

    const result = await registry.execute("mock-tool", { foo: "bar" });

    expect(result.success).toBe(true);
    expect(result.output).toEqual({ message: "executed", input: { foo: "bar" } });
  });

  it("should handle tool execution failure", async () => {
    const registry = new ToolRegistry();
    registry.register(new FailingTool());

    const result = await registry.execute("failing-tool", {});

    expect(result.success).toBe(false);
    expect(result.error).toBe("Tool execution failed");
  });

  it("should return error for unknown tool execution", async () => {
    const registry = new ToolRegistry();

    const result = await registry.execute("unknown", {});

    expect(result.success).toBe(false);
    expect(result.error).toContain("Tool not found");
  });

  it("should return tool descriptions", () => {
    const registry = new ToolRegistry();
    registry.register(new MockTool());

    const descriptions = registry.getToolDescriptions();

    expect(descriptions).toHaveLength(1);
    expect(descriptions[0].id).toBe("mock-tool");
    expect(descriptions[0].name).toBe("Mock Tool");
  });

  it("should overwrite existing tool on re-register", () => {
    const registry = new ToolRegistry();
    const tool1 = new MockTool();
    const tool2 = new FailingTool();

    registry.register(tool1);
    registry.register(tool2);

    expect(registry.list()).toHaveLength(2);
  });
});
