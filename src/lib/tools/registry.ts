// Tool Registry
// Central registry of all available tools.
// Agents discover and call tools through this registry.

import { logger } from "../logging";
import type { Tool, ToolResult } from "./types";

export class ToolRegistry {
  private tools: Map<string, Tool> = new Map();

  register(tool: Tool): void {
    if (this.tools.has(tool.id)) {
      logger.warn(`[ToolRegistry] Tool ${tool.id} already registered, overwriting`);
    }
    this.tools.set(tool.id, tool);
  }

  get(toolId: string): Tool | undefined {
    return this.tools.get(toolId);
  }

  list(): Tool[] {
    return Array.from(this.tools.values());
  }

  has(toolId: string): boolean {
    return this.tools.has(toolId);
  }

  async execute(
    toolId: string,
    input: Record<string, unknown>
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolId);
    if (!tool) {
      return {
        success: false,
        output: null,
        error: `Tool not found: ${toolId}`,
      };
    }

    try {
      return await tool.execute(input);
    } catch (error) {
      return {
        success: false,
        output: null,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  getToolDescriptions(): Array<{
    id: string;
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
  }> {
    return this.list().map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    }));
  }
}
