// Store Builder Workflow
// Orchestrates product listing creation pipeline.
// FASE 32: Product draft workflow with SEO optimization and approval.

import { getSourceTypeManager } from "./source-type-manager";
import { getApprovalManager } from "./approval-manager";

export type StoreBuilderStep =
  | "research"
  | "draft"
  | "seo_optimization"
  | "pricing"
  | "review"
  | "approved"
  | "listed";

export interface ProductDraftInput {
  /** Product name */
  productName: string;
  /** Product description */
  description: string;
  /** Price */
  price: number;
  /** Cost from supplier */
  costPrice: number;
  /** Category */
  category: string;
  /** Features/benefits */
  features?: string[];
  /** Images (URLs) */
  images?: string[];
  /** Supplier source */
  sourceId?: string;
  /** Target marketplace */
  marketplace?: string;
  /** Workspace ID */
  workspaceId?: string;
}

export interface ProductDraft {
  /** SEO-optimized title */
  title: string;
  /** SEO-optimized description */
  description: string;
  /** Bullet points */
  bulletPoints: string[];
  /** Price */
  price: number;
  /** Compare-at price (original) */
  compareAtPrice?: number;
  /** Cost */
  cost: number;
  /** Margin */
  margin: number;
  /** Margin percent */
  marginPercent: number;
  /** Category */
  category: string;
  /** Tags */
  tags: string[];
  /** SEO keywords */
  seoKeywords: string[];
  /** Meta description */
  metaDescription: string;
  /** Source type */
  sourceType: "mock" | "real";
  /** Approval required */
  requiresApproval: boolean;
  /** Approval ID */
  approvalId: string | null;
}

export interface StoreBuilderResult {
  workflowId: string;
  currentStep: StoreBuilderStep;
  completedSteps: StoreBuilderStep[];
  draft: ProductDraft | null;
  errors: string[];
}

/**
 * Store Builder Workflow
 * Creates optimized product listings with SEO and approval.
 */
export class StoreBuilderWorkflow {
  /**
   * Execute the product draft workflow.
   */
  async execute(input: ProductDraftInput): Promise<StoreBuilderResult> {
    const workflowId = `sb-${Date.now()}`;
    const completedSteps: StoreBuilderStep[] = [];
    const errors: string[] = [];

    // Step 1: Research (track source)
    let sourceType: "mock" | "real" = "mock";
    if (input.sourceId) {
      const stm = getSourceTypeManager();
      const source = stm.getSource(input.sourceId);
      sourceType = source?.type === "real" ? "real" : "mock";
    }
    completedSteps.push("research");

    // Step 2: Draft
    const margin = input.price - input.costPrice;
    const marginPercent = input.price > 0 ? margin / input.price : 0;

    const draft: ProductDraft = {
      title: this.optimizeTitle(input.productName, input.category),
      description: this.optimizeDescription(input.description, input.features),
      bulletPoints: this.generateBulletPoints(input.features),
      price: input.price,
      compareAtPrice: Math.round(input.price * 1.3 * 100) / 100,
      cost: input.costPrice,
      margin,
      marginPercent: Math.round(marginPercent * 10000) / 100,
      category: input.category,
      tags: this.generateTags(input.productName, input.category),
      seoKeywords: this.generateKeywords(input.productName, input.category),
      metaDescription: this.generateMetaDescription(input.productName, input.description),
      sourceType,
      requiresApproval: false,
      approvalId: null,
    };
    completedSteps.push("draft");

    // Step 3: SEO Optimization (already done in draft)
    completedSteps.push("seo_optimization");

    // Step 4: Pricing (already calculated)
    completedSteps.push("pricing");

    // Step 5: Review — check if approval needed
    if (marginPercent < 0.15 || sourceType === "mock") {
      draft.requiresApproval = true;
      try {
        const approvalManager = getApprovalManager();
        const approval = await approvalManager.createApproval({
          agent_id: "store-builder",
          action_type: "product_listing",
          action_summary: `List product: ${input.productName}`,
          action_details: {
            productName: input.productName,
            price: input.price,
            margin: marginPercent,
            sourceType,
          },
          risk_level: marginPercent < 0.15 ? "high" : "medium",
        });
        draft.approvalId = approval.id;
      } catch (error) {
        errors.push(`Approval failed: ${error instanceof Error ? error.message : "Unknown"}`);
      }
    }
    completedSteps.push("review");

    return {
      workflowId,
      currentStep: draft.requiresApproval ? "review" : "approved",
      completedSteps,
      draft,
      errors,
    };
  }

  private optimizeTitle(name: string, category: string): string {
    return `${name} | ${category} | Premium Quality`;
  }

  private optimizeDescription(description: string, features?: string[]): string {
    let desc = description;
    if (features && features.length > 0) {
      desc += `\n\nKey Features:\n${features.map((f) => `• ${f}`).join("\n")}`;
    }
    return desc;
  }

  private generateBulletPoints(features?: string[]): string[] {
    if (!features || features.length === 0) {
      return ["Premium quality materials", "Fast shipping", "30-day return policy"];
    }
    return features.map((f) => f.charAt(0).toUpperCase() + f.slice(1));
  }

  private generateTags(name: string, category: string): string[] {
    const words = name.toLowerCase().split(/\s+/);
    return [...words.slice(0, 3), category.toLowerCase(), "premium", "best-seller"];
  }

  private generateKeywords(name: string, category: string): string[] {
    return [
      name.toLowerCase(),
      category.toLowerCase(),
      `buy ${name.toLowerCase()}`,
      `${name.toLowerCase()} online`,
      `best ${category.toLowerCase()}`,
    ];
  }

  private generateMetaDescription(name: string, description: string): string {
    return `${name} — ${description.slice(0, 140)}...`;
  }
}

// Singleton
let instance: StoreBuilderWorkflow | null = null;

export function getStoreBuilderWorkflow(): StoreBuilderWorkflow {
  if (!instance) {
    instance = new StoreBuilderWorkflow();
  }
  return instance;
}
