// Supplier Result Contract
// Standardized output types for all supplier-related results.
// FASE 22: Ensures consistency across SupplierResearch, SupplierWorkflow, and future components.

import { z } from "zod";

// --- Zod Schemas (runtime validation) ---

export const SupplierShippingOptionSchema = z.object({
  method: z.string(),
  estimatedDays: z.number().min(0),
  cost: z.number().min(0),
  currency: z.string().default("USD"),
});

export const SupplierPriceRangeSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  currency: z.string().default("USD"),
});

export const SupplierEntrySchema = z.object({
  id: z.string(),
  name: z.string(),
  location: z.string(),
  platform: z.string(),
  url: z.string().optional(),
  reliabilityScore: z.number().min(0).max(100),
  priceRange: SupplierPriceRangeSchema,
  shippingOptions: z.array(SupplierShippingOptionSchema),
  moq: z.number().min(0).optional(),
  paymentTerms: z.string().optional(),
  notes: z.string(),
  /** Source of this supplier data */
  dataSource: z.enum(["ai-research", "api", "manual", "mock"]).default("ai-research"),
  /** When this data was collected */
  collectedAt: z.string().datetime().optional(),
});

export const SupplierLandedCostSchema = z.object({
  min: z.number().min(0),
  max: z.number().min(0),
  currency: z.string().default("USD"),
  breakdown: z.object({
    productCost: z.object({ min: z.number(), max: z.number() }),
    shippingCost: z.object({ min: z.number(), max: z.number() }),
    platformFeePercent: z.number().min(0).max(1),
    importDuties: z.number().min(0).optional(),
  }),
});

export const SupplierRiskSchema = z.object({
  factor: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  mitigation: z.string().optional(),
});

export const SupplierScoreSchema = z.object({
  overall: z.number().min(0).max(100),
  reliability: z.number().min(0).max(100),
  pricing: z.number().min(0).max(100),
  shipping: z.number().min(0).max(100),
  communication: z.number().min(0).max(100),
});

export const SupplierResultContractSchema = z.object({
  /** Whether the supplier research was successful */
  success: z.boolean(),
  /** Product this research is for */
  productName: z.string(),
  /** Category */
  category: z.string(),
  /** Target market */
  targetMarket: z.string().default("Europe"),

  /** Ranked list of suppliers (best first) */
  suppliers: z.array(SupplierEntrySchema),

  /** ID of the recommended supplier (must match one in suppliers[]) */
  recommendedSupplierId: z.string().optional(),

  /** Overall recommendation text */
  recommendation: z.string(),

  /** Risk factors identified */
  risks: z.array(SupplierRiskSchema),

  /** Landed cost estimate */
  landedCost: SupplierLandedCostSchema.optional(),

  /** Scoring breakdown */
  scores: SupplierScoreSchema.optional(),

  /** Source type marking (FASE 25) */
  sourceType: z.enum(["mock", "real", "hybrid"]).default("mock"),

  /** Traceability */
  metadata: z.object({
    agentsUsed: z.array(z.string()),
    totalInputTokens: z.number().min(0),
    totalOutputTokens: z.number().min(0),
    durationMs: z.number().min(0),
    modelUsed: z.string().optional(),
    providerUsed: z.string().optional(),
  }),
});

// --- TypeScript Types ---

export type SupplierShippingOption = z.infer<typeof SupplierShippingOptionSchema>;
export type SupplierPriceRange = z.infer<typeof SupplierPriceRangeSchema>;
export type SupplierEntry = z.infer<typeof SupplierEntrySchema>;
export type SupplierLandedCost = z.infer<typeof SupplierLandedCostSchema>;
export type SupplierRisk = z.infer<typeof SupplierRiskSchema>;
export type SupplierScore = z.infer<typeof SupplierScoreSchema>;
export type SupplierResult = z.infer<typeof SupplierResultContractSchema>;

// --- Helper Functions ---

/**
 * Validate a supplier result against the contract.
 * Returns { valid, errors } for use in debugging/testing.
 */
export function validateSupplierResult(data: unknown): {
  valid: boolean;
  errors: string[];
  data?: SupplierResult;
} {
  const result = SupplierResultContractSchema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [], data: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { valid: false, errors };
}

/**
 * Create a minimal valid supplier result (for testing/mocking).
 */
export function createMockSupplierResult(
  overrides?: Partial<SupplierResult>
): SupplierResult {
  return {
    success: true,
    productName: "Test Product",
    category: "general",
    targetMarket: "Europe",
    suppliers: [
      {
        id: "supplier-1",
        name: "Test Supplier",
        location: "China",
        platform: "AliExpress",
        reliabilityScore: 80,
        priceRange: { min: 5, max: 15, currency: "USD" },
        shippingOptions: [
          { method: "Standard", estimatedDays: 15, cost: 3, currency: "USD" },
        ],
        notes: "Test supplier",
        dataSource: "mock",
      },
    ],
    recommendedSupplierId: "supplier-1",
    recommendation: "Recommended for testing",
    risks: [],
    sourceType: "mock",
    metadata: {
      agentsUsed: ["supplier-research"],
      totalInputTokens: 100,
      totalOutputTokens: 50,
      durationMs: 1000,
    },
    ...overrides,
  };
}

/**
 * Get the best supplier from a result (by reliability score).
 */
export function getBestSupplier(result: SupplierResult): SupplierEntry | undefined {
  if (result.suppliers.length === 0) return undefined;

  // Use recommended if specified
  if (result.recommendedSupplierId) {
    const recommended = result.suppliers.find(
      (s) => s.id === result.recommendedSupplierId
    );
    if (recommended) return recommended;
  }

  // Fallback to highest reliability
  return [...result.suppliers].sort(
    (a, b) => b.reliabilityScore - a.reliabilityScore
  )[0];
}

/**
 * Calculate average shipping cost across all suppliers.
 */
export function getAverageShippingCost(result: SupplierResult): number {
  if (result.suppliers.length === 0) return 0;

  let totalCost = 0;
  let optionCount = 0;

  for (const supplier of result.suppliers) {
    for (const option of supplier.shippingOptions) {
      totalCost += option.cost;
      optionCount++;
    }
  }

  return optionCount > 0 ? totalCost / optionCount : 0;
}

/**
 * Filter suppliers by minimum reliability score.
 */
export function filterByReliability(
  result: SupplierResult,
  minScore: number
): SupplierEntry[] {
  return result.suppliers.filter((s) => s.reliabilityScore >= minScore);
}
