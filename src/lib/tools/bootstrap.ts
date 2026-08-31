// Tools Bootstrap
// SINGLE file that imports and registers all concrete tools.
// This is the ONLY place that knows about specific tool implementations.

import { ToolRegistry } from "./registry";
import { CalculateMarginTool } from "./calculate-margin";
import { SearchProductsTool } from "./search-products";

let toolRegistry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!toolRegistry) {
    toolRegistry = new ToolRegistry();
    toolRegistry.register(new CalculateMarginTool());
    toolRegistry.register(new SearchProductsTool());
  }
  return toolRegistry;
}
