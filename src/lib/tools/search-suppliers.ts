// Supplier Search Tool
// Searches for suppliers using mock data (swappable with real APIs later).
// Mock data simulates AliExpress, Alibaba, and local EU suppliers.
// FASE: Swappable tool providers — replace mock with real API when ready.

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
  source_type: "mock" | "real";
}

// Mock supplier database
const MOCK_SUPPLIERS: SupplierResult[] = [
  {
    name: "TechGear Direct",
    location: "Shenzhen, China",
    platform: "AliExpress",
    reliabilityScore: 85,
    priceRange: { min: 5, max: 25, currency: "USD" },
    shippingOptions: [
      { method: "ePacket", estimatedDays: 15, cost: 3 },
      { method: "AliExpress Standard", estimatedDays: 12, cost: 5 },
      { method: "DHL Express", estimatedDays: 5, cost: 15 },
    ],
    moq: 1,
    paymentTerms: "PayPal, Credit Card, Alipay",
    notes: "High volume seller, good for electronics and gadgets",
    source_type: "mock",
  },
  {
    name: "FashionHub Wholesale",
    location: "Guangzhou, China",
    platform: "Alibaba",
    reliabilityScore: 78,
    priceRange: { min: 3, max: 15, currency: "USD" },
    shippingOptions: [
      { method: "China Post", estimatedDays: 25, cost: 2 },
      { method: "AliExpress Standard", estimatedDays: 15, cost: 4 },
    ],
    moq: 5,
    paymentTerms: "Trade Assurance, T/T",
    notes: "Best for fashion and accessories, negotiate for lower MOQ",
    source_type: "mock",
  },
  {
    name: "EU Dropship Hub",
    location: "Poland",
    platform: "Local EU",
    reliabilityScore: 92,
    priceRange: { min: 8, max: 35, currency: "EUR" },
    shippingOptions: [
      { method: "DPD", estimatedDays: 3, cost: 4 },
      { method: "InPost", estimatedDays: 2, cost: 3 },
    ],
    moq: 1,
    paymentTerms: "SEPA, Credit Card",
    notes: "Fast EU delivery, higher prices but no customs issues",
    source_type: "mock",
  },
  {
    name: "Gadget Palace",
    location: "Yiwu, China",
    platform: "1688",
    reliabilityScore: 72,
    priceRange: { min: 2, max: 12, currency: "USD" },
    shippingOptions: [
      { method: "ePacket", estimatedDays: 18, cost: 2.5 },
      { method: "Standard", estimatedDays: 20, cost: 3 },
    ],
    moq: 10,
    paymentTerms: "Alipay, T/T",
    notes: "Cheapest prices but higher MOQ, good for proven winners",
    source_type: "mock",
  },
];

export class SearchSuppliersTool implements Tool {
  readonly id = "search_suppliers";
  readonly name = "Search Suppliers";
  readonly description = "Search for suppliers by product category or name. DEV ONLY: returns mock data. Replace with real APIs (AliExpress, Alibaba) for production.";
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
    const query = (input.query as string || "").toLowerCase();
    const platform = input.platform as string | undefined;
    const minReliability = (input.minReliability as number) || 0;
    const limit = (input.limit as number) || 5;

    let results = MOCK_SUPPLIERS.filter((s) => {
      // Match query against name, platform, or notes
      const matchesQuery =
        s.name.toLowerCase().includes(query) ||
        s.platform.toLowerCase().includes(query) ||
        s.notes.toLowerCase().includes(query) ||
        query.split(" ").some((word) => s.notes.toLowerCase().includes(word));

      const matchesPlatform = !platform || s.platform.toLowerCase().includes(platform.toLowerCase());
      const matchesReliability = s.reliabilityScore >= minReliability;

      return matchesQuery && matchesPlatform && matchesReliability;
    });

    // Sort by reliability score
    results.sort((a, b) => b.reliabilityScore - a.reliabilityScore);

    // Apply limit
    results = results.slice(0, limit);

    return {
      success: true,
      output: {
        suppliers: results,
        totalFound: results.length,
        source_type: "mock",
        query: input.query,
      },
    };
  }
}
