// Product Result Contract
// Standardized output types for all product-related results.
// FASE 23: Ensures consistency across ProductHunter, ProductAnalysis, and future components.

import { z } from "zod";

// --- Zod Schemas (runtime validation) ---

export const DataConfidenceSchema = z.enum(["KNOWN", "ESTIMATED", "UNKNOWN"]);

export const ProductDataConfidenceSchema = z.object({
  supplierPrice: DataConfidenceSchema,
  sellingPrice: DataConfidenceSchema,
  demand: DataConfidenceSchema,
  competition: DataConfidenceSchema,
  shippingCost: DataConfidenceSchema,
});

export const ProductScoresSchema = z.object({
  /** Overall opportunity score (0-100) */
  overall: z.number().min(0).max(100),
  /** Demand level (0-100) */
  demand: z.number().min(0).max(100),
  /** Competition level (0-100, higher = less competition) */
  competition: z.number().min(0).max(100),
  /** Supplier quality (0-100) */
  supplier: z.number().min(0).max(100),
  /** Risk level (0-100, lower = less risk) */
  risk: z.number().min(0).max(100),
  /** Profitability score (0-100) */
  profitability: z.number().min(0).max(100),
});

export const ProductPricingSchema = z.object({
  /** Supplier cost price */
  costPrice: z.number().min(0),
  /** Recommended selling price */
  sellingPrice: z.number().min(0),
  /** Currency code */
  currency: z.string().default("EUR"),
  /** Estimated profit per unit */
  profit: z.number(),
  /** Profit margin percentage */
  marginPercent: z.number(),
  /** Return on investment percentage */
  roiPercent: z.number(),
  /** Whether margin was validated by backend tool */
  marginValidated: z.boolean().default(false),
});

export const ProductMarketContextSchema = z.object({
  /** Product category */
  category: z.string(),
  /** Target markets */
  targetMarkets: z.array(z.string()),
  /** Market size estimate */
  marketSize: z.string().optional(),
  /** Key trends */
  trends: z.array(z.object({
    name: z.string(),
    direction: z.enum(["growing", "stable", "declining"]),
    strength: z.number().min(0).max(100),
  })).optional(),
  /** Seasonality */
  seasonality: z.string().optional(),
});

export const ProductSupplierContextSchema = z.object({
  /** Number of suppliers found */
  supplierCount: z.number().min(0),
  /** Best supplier name */
  bestSupplier: z.string().optional(),
  /** Average supplier reliability */
  averageReliability: z.number().min(0).max(100).optional(),
  /** Price range across suppliers */
  priceRange: z.object({
    min: z.number(),
    max: z.number(),
    currency: z.string(),
  }).optional(),
});

export const ProductDecisionSchema = z.enum([
  "INVESTIGATE",
  "APPROVE",
  "REJECT",
  "NEEDS_MORE_DATA",
]);

export const ProductRiskSchema = z.object({
  factor: z.string(),
  severity: z.enum(["low", "medium", "high"]),
  description: z.string(),
  mitigation: z.string().optional(),
});

export const ProductResultContractSchema = z.object({
  /** Whether the product analysis was successful */
  success: z.boolean(),

  /** Product identifier */
  productId: z.string(),
  /** Product name */
  productName: z.string(),
  /** Source product URL */
  url: z.string().optional(),
  /** Source image */
  imageUrl: z.string().optional(),
  /** Source platform */
  source: z.string(),
  /** External ID from source */
  sourceId: z.string().optional(),

  /** Scores breakdown */
  scores: ProductScoresSchema,

  /** Pricing analysis */
  pricing: ProductPricingSchema,

  /** Decision */
  decision: ProductDecisionSchema,

  /** Human-readable explanation */
  explanation: z.string(),

  /** Data confidence classification */
  dataConfidence: ProductDataConfidenceSchema,

  /** Market context */
  marketContext: ProductMarketContextSchema.optional(),

  /** Supplier context */
  supplierContext: ProductSupplierContextSchema.optional(),

  /** Identified risks */
  risks: z.array(ProductRiskSchema),

  /** Action items */
  actionItems: z.array(z.object({
    priority: z.enum(["critical", "high", "medium", "low"]),
    action: z.string(),
    reason: z.string(),
  })),

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

export type DataConfidence = z.infer<typeof DataConfidenceSchema>;
export type ProductDataConfidence = z.infer<typeof ProductDataConfidenceSchema>;
export type ProductScores = z.infer<typeof ProductScoresSchema>;
export type ProductPricing = z.infer<typeof ProductPricingSchema>;
export type ProductMarketContext = z.infer<typeof ProductMarketContextSchema>;
export type ProductSupplierContext = z.infer<typeof ProductSupplierContextSchema>;
export type ProductDecision = z.infer<typeof ProductDecisionSchema>;
export type ProductRisk = z.infer<typeof ProductRiskSchema>;
export type ProductResult = z.infer<typeof ProductResultContractSchema>;

// --- Helper Functions ---

/**
 * Validate a product result against the contract.
 */
export function validateProductResult(data: unknown): {
  valid: boolean;
  errors: string[];
  data?: ProductResult;
} {
  const result = ProductResultContractSchema.safeParse(data);

  if (result.success) {
    return { valid: true, errors: [], data: result.data };
  }

  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );

  return { valid: false, errors };
}

/**
 * Create a minimal valid product result (for testing/mocking).
 */
export function createMockProductResult(
  overrides?: Partial<ProductResult>
): ProductResult {
  return {
    success: true,
    productId: "product-1",
    productName: "Test Product",
    source: "mock",
    scores: {
      overall: 75,
      demand: 70,
      competition: 65,
      supplier: 80,
      risk: 30,
      profitability: 72,
    },
    pricing: {
      costPrice: 10,
      sellingPrice: 29.99,
      currency: "EUR",
      profit: 15.49,
      marginPercent: 51.6,
      roiPercent: 154.9,
      marginValidated: true,
    },
    decision: "INVESTIGATE",
    explanation: "Good opportunity with solid margins",
    dataConfidence: {
      supplierPrice: "KNOWN",
      sellingPrice: "ESTIMATED",
      demand: "ESTIMATED",
      competition: "ESTIMATED",
      shippingCost: "UNKNOWN",
    },
    risks: [],
    actionItems: [],
    sourceType: "mock",
    metadata: {
      agentsUsed: ["product-hunter"],
      totalInputTokens: 100,
      totalOutputTokens: 50,
      durationMs: 1000,
    },
    ...overrides,
  };
}

/**
 * Check if a product is viable (decision is APPROVE or INVESTIGATE).
 */
export function isProductViable(result: ProductResult): boolean {
  return result.decision === "APPROVE" || result.decision === "INVESTIGATE";
}

/**
 * Get the profit margin percentage.
 */
export function getMarginPercent(result: ProductResult): number {
  return result.pricing.marginPercent;
}

/**
 * Check if all data points are KNOWN (no estimates).
 */
export function isFullyVerified(result: ProductResult): boolean {
  const { dataConfidence } = result;
  return (
    dataConfidence.supplierPrice === "KNOWN" &&
    dataConfidence.sellingPrice === "KNOWN" &&
    dataConfidence.demand === "KNOWN" &&
    dataConfidence.competition === "KNOWN" &&
    dataConfidence.shippingCost === "KNOWN"
  );
}

/**
 * Get count of high-severity risks.
 */
export function getHighRiskCount(result: ProductResult): number {
  return result.risks.filter((r) => r.severity === "high").length;
}

/**
 * Get critical action items.
 */
export function getCriticalActions(result: ProductResult): ProductResult["actionItems"] {
  return result.actionItems.filter((a) => a.priority === "critical");
}
