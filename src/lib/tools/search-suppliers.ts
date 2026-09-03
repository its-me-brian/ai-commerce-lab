// Supplier Search Tool
// Searches for suppliers using real APIs.
// FASE: Swappable tool providers — implement real API adapters.

import type { Tool, ToolResult } from "./types";

export interface SupplierResult {
  name: string;
  location: string;
  platform: string;
  reliabilityScore: number;
  priceRange: { min: number; max: number; currency: string };
  shippingOptions: Array<{
    method: string;
    estimatedDays: number;
    cost: number;
  }>;
  moq: number;
  paymentTerms: string;
  notes: string;
  source_type: "real";
}

export class SearchSuppliersTool implements Tool {
  readonly id = "search_suppliers";
  readonly name = "Search Suppliers";
  readonly description = "Search for suppliers by product category or name. Requires real API integration (AliExpress, Alibaba).";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: { type: "string", description: "Product name or category to search suppliers for" },
      category: { type: "string", description: "Product category filter" },
      platform: { type: "string", description: "Platform filter (AliExpress, Alibaba, 1688, Local EU)" },
      limit: { type: "number", description: "Max results to return", default: 5 },
      minReliability: { type: "number", description: "Minimum reliability score (0-100)" },
    },
    required: ["query"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      suppliers: { type: "array" },
      totalFound: { type: "number" },
      source_type: { type: "string" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    // No real supplier API configured yet — return clear error
    return {
      success: false,
      output: null,
      error: "No supplier API configured. Integrate a real supplier API (AliExpress, Alibaba) to use this tool.",
    };
  }
}
