// Tools Bootstrap
// SINGLE file that imports and registers all concrete tools.
// This is the ONLY place that knows about specific tool implementations.

import { ToolRegistry } from "./registry";
import { CalculateMarginTool } from "./calculate-margin";

let toolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
    toolRegistry.register(new CalculateMarginTool());
  }
  return toolRegistry;
}
