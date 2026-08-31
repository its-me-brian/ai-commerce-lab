// Supplier Workflow Tests

import { describe, it, expect, vi, beforeEach } from "vitest";

// Hoisted mocks
const { mockOrchestratorExecute, mockOrchestratorGetStructuredData } = vi.hoisted(() => ({
  mockOrchestratorExecute: vi.fn(),
  mockOrchestratorGetStructuredData: vi.fn(),
}));

// Mock Supabase
const mockFrom = vi.fn();
vi.mock("../database/supabase", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

// Mock bootstrap
vi.mock("./bootstrap", () => ({
  bootstrap: vi.fn().mockResolvedValue(undefined),
  getAgentRegistry: vi.fn().mockReturnValue({
    get: vi.fn().mockReturnValue({ isEnabled: () => true }),
    has: vi.fn().mockReturnValue(true),
  }),
}));

// Mock orchestrator
vi.mock("./multi-agent-orchestrator", () => ({
  getMultiAgentOrchestrator: vi.fn().mockReturnValue({
    execute: mockOrchestratorExecute,
    getStructuredData: mockOrchestratorGetStructuredData,
  }),
}));

import { SupplierWorkflow } from "./supplier-workflow";

describe("SupplierWorkflow", () => {
  let workflow: SupplierWorkflow;

  beforeEach(() => {
    vi.clearAllMocks();
    workflow = new SupplierWorkflow();
  });

  it("should create an instance", () => {
    expect(workflow).toBeDefined();
    expect(workflow).toBeInstanceOf(SupplierWorkflow);
  });

  describe("execute", () => {
    it("should execute supplier research workflow", async () => {
      // Mock supplier research result
      mockOrchestratorExecute.mockResolvedValueOnce({
        results: [
          {
            agentId: "supplier-research",
            result: {
              structuredData: {
                suppliers: [
                  {
                    name: "AliExpress Supplier",
                    location: "China",
                    platform: "AliExpress",
                    reliabilityScore: 85,
                    priceRange: { min: 5, max: 15, currency: "USD" },
                    shippingOptions: [
                      { method: "ePacket", estimatedDays: 15, cost: 3 },
                    ],
                    notes: "Good reliability",
                  },
                ],
                recommendation: "Recommended for dropshipping",
                bestOption: "AliExpress Supplier",
                riskFactors: ["Long shipping times"],
              },
            },
          },
        ],
        success: true,
        errors: [],
        totalInputTokens: 100,
        totalOutputTokens: 50,
      });

      mockOrchestratorGetStructuredData.mockReturnValueOnce({
        suppliers: [
          {
            name: "AliExpress Supplier",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 85,
            priceRange: { min: 5, max: 15, currency: "USD" },
            shippingOptions: [
              { method: "ePacket", estimatedDays: 15, cost: 3 },
            ],
            notes: "Good reliability",
          },
        ],
        recommendation: "Recommended for dropshipping",
        bestOption: "AliExpress Supplier",
        riskFactors: ["Long shipping times"],
      });

      const result = await workflow.execute({
        productName: "LED Lamp",
        category: "electronics",
      });

      expect(result.success).toBe(true);
      expect(result.productName).toBe("LED Lamp");
      expect(result.suppliers).toHaveLength(1);
      expect(result.bestOption).toBe("AliExpress Supplier");
      expect(result.estimatedLandedCost).toBeDefined();
    });

    it("should include market context when requested", async () => {
      // Mock market research result
      mockOrchestratorExecute
        .mockResolvedValueOnce({
          results: [
            {
              agentId: "market-research",
              result: {
                structuredData: {
                  competition: { level: "medium" },
                  demand: { score: 75 },
                  trends: [{ name: "Smart Home", direction: "growing" }],
                },
              },
            },
          ],
          success: true,
          errors: [],
          totalInputTokens: 80,
          totalOutputTokens: 40,
        })
        // Mock supplier research result
        .mockResolvedValueOnce({
          results: [
            {
              agentId: "supplier-research",
              result: {
                structuredData: {
                  suppliers: [
                    {
                      name: "Alibaba Supplier",
                      location: "China",
                      platform: "Alibaba",
                      reliabilityScore: 90,
                      priceRange: { min: 3, max: 10, currency: "USD" },
                      shippingOptions: [
                        { method: "Standard", estimatedDays: 20, cost: 2 },
                      ],
                      notes: "Bulk supplier",
                    },
                  ],
                  recommendation: "Good for bulk orders",
                  bestOption: "Alibaba Supplier",
                  riskFactors: [],
                },
              },
            },
          ],
          success: true,
          errors: [],
          totalInputTokens: 100,
          totalOutputTokens: 50,
        });

      mockOrchestratorGetStructuredData
        .mockReturnValueOnce({
          competition: { level: "medium" },
          demand: { score: 75 },
          trends: [{ name: "Smart Home", direction: "growing" }],
        })
        .mockReturnValueOnce({
          suppliers: [
            {
              name: "Alibaba Supplier",
              location: "China",
              platform: "Alibaba",
              reliabilityScore: 90,
              priceRange: { min: 3, max: 10, currency: "USD" },
              shippingOptions: [
                { method: "Standard", estimatedDays: 20, cost: 2 },
              ],
              notes: "Bulk supplier",
            },
          ],
          recommendation: "Good for bulk orders",
          bestOption: "Alibaba Supplier",
          riskFactors: [],
        });

      const result = await workflow.execute({
        productName: "Smart LED Lamp",
        category: "electronics",
        includeMarketContext: true,
      });

      expect(result.success).toBe(true);
      expect(result.marketContext).toBeDefined();
      expect(result.marketContext?.competitionLevel).toBe("medium");
      expect(result.marketContext?.demandScore).toBe(75);
      expect(result.metadata.agentsUsed).toContain("market-research");
      expect(result.metadata.agentsUsed).toContain("supplier-research");
    });

    it("should calculate landed costs correctly", async () => {
      mockOrchestratorExecute.mockResolvedValueOnce({
        results: [
          {
            agentId: "supplier-research",
            result: {
              structuredData: {
                suppliers: [
                  {
                    name: "Supplier A",
                    location: "China",
                    platform: "AliExpress",
                    reliabilityScore: 80,
                    priceRange: { min: 5, max: 10, currency: "USD" },
                    shippingOptions: [
                      { method: "ePacket", estimatedDays: 15, cost: 3 },
                      { method: "Express", estimatedDays: 7, cost: 8 },
                    ],
                    notes: "Fast shipping option",
                  },
                ],
                recommendation: "Good option",
                bestOption: "Supplier A",
                riskFactors: [],
              },
            },
          },
        ],
        success: true,
        errors: [],
        totalInputTokens: 100,
        totalOutputTokens: 50,
      });

      mockOrchestratorGetStructuredData.mockReturnValueOnce({
        suppliers: [
          {
            name: "Supplier A",
            location: "China",
            platform: "AliExpress",
            reliabilityScore: 80,
            priceRange: { min: 5, max: 10, currency: "USD" },
            shippingOptions: [
              { method: "ePacket", estimatedDays: 15, cost: 3 },
              { method: "Express", estimatedDays: 7, cost: 8 },
            ],
            notes: "Fast shipping option",
          },
        ],
        recommendation: "Good option",
        bestOption: "Supplier A",
        riskFactors: [],
      });

      const result = await workflow.execute({
        productName: "LED Lamp",
        category: "electronics",
      });

      expect(result.estimatedLandedCost).toBeDefined();
      expect(result.estimatedLandedCost?.min).toBe(8); // 5 + 3
      expect(result.estimatedLandedCost?.max).toBe(18); // 10 + 8
      expect(result.estimatedLandedCost?.breakdown.productCost.min).toBe(5);
      expect(result.estimatedLandedCost?.breakdown.productCost.max).toBe(10);
      expect(result.estimatedLandedCost?.breakdown.shippingCost.min).toBe(3);
      expect(result.estimatedLandedCost?.breakdown.shippingCost.max).toBe(8);
    });

    it("should handle supplier research failure", async () => {
      mockOrchestratorExecute.mockResolvedValueOnce({
        results: [],
        success: false,
        errors: ["Agent failed"],
        totalInputTokens: 0,
        totalOutputTokens: 0,
      });

      const result = await workflow.execute({
        productName: "LED Lamp",
        category: "electronics",
      });

      expect(result.success).toBe(false);
      expect(result.suppliers).toHaveLength(0);
      expect(result.riskFactors).toContain("Unable to complete supplier research");
    });

    it("should return metadata with token counts", async () => {
      mockOrchestratorExecute.mockResolvedValueOnce({
        results: [
          {
            agentId: "supplier-research",
            result: {
              structuredData: {
                suppliers: [],
                recommendation: "No suppliers found",
                bestOption: "",
                riskFactors: [],
              },
            },
          },
        ],
        success: true,
        errors: [],
        totalInputTokens: 150,
        totalOutputTokens: 80,
      });

      mockOrchestratorGetStructuredData.mockReturnValueOnce({
        suppliers: [],
        recommendation: "No suppliers found",
        bestOption: "",
        riskFactors: [],
      });

      const result = await workflow.execute({
        productName: "LED Lamp",
        category: "electronics",
      });

      expect(result.metadata.agentsUsed).toContain("supplier-research");
      expect(result.metadata.totalInputTokens).toBe(150);
      expect(result.metadata.totalOutputTokens).toBe(80);
      expect(result.metadata.durationMs).toBeGreaterThanOrEqual(0);
    });
  });
});
