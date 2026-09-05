// Workflow Bootstrap
// Registers all built-in workflow definitions.
// Call once at application startup.
//
// Pattern: same as src/lib/ai/mini-ai/bootstrap.ts

import { logger } from "../../logging";
import { getWorkflowRegistry } from "./registry";
import type { WorkflowDefinition } from "./types";

/**
 * Built-in workflow: Product Research
 * Researches a product idea, classifies it, and extracts key information.
 */
export const productResearchWorkflow: WorkflowDefinition = {
  id: "product-research",
  name: "Product Research",
  description: "Research a product idea, classify its category, and extract key market data",
  version: "1.0.0",
  tags: ["product", "research", "ecommerce"],
  enabled: true,
  nodes: [
    {
      id: "research",
      name: "Research Product",
      type: "mini-ai",
      miniAIId: "researcher",
      inputMapping: {
        query: "input.productIdea",
      },
    },
    {
      id: "classify",
      name: "Classify Category",
      type: "mini-ai",
      miniAIId: "classifier",
      inputMapping: {
        text: "research.output.text",
      },
    },
    {
      id: "extract",
      name: "Extract Key Data",
      type: "mini-ai",
      miniAIId: "extractor",
      inputMapping: {
        text: "research.output.text",
      },
    },
  ],
};

/**
 * Built-in workflow: Supplier Evaluation
 * Researches suppliers, evaluates their credibility, and summarizes findings.
 */
export const supplierEvaluationWorkflow: WorkflowDefinition = {
  id: "supplier-evaluation",
  name: "Supplier Evaluation",
  description: "Research suppliers for a product, evaluate credibility, and summarize findings",
  version: "1.0.0",
  tags: ["supplier", "evaluation", "ecommerce"],
  enabled: true,
  nodes: [
    {
      id: "research-suppliers",
      name: "Research Suppliers",
      type: "mini-ai",
      miniAIId: "researcher",
      inputMapping: {
        query: "input.productName",
      },
    },
    {
      id: "validate-suppliers",
      name: "Validate Credibility",
      type: "mini-ai",
      miniAIId: "validator",
      inputMapping: {
        data: "research-suppliers.output.text",
      },
    },
    {
      id: "summarize",
      name: "Summarize Findings",
      type: "mini-ai",
      miniAIId: "summarizer",
      inputMapping: {
        text: "research-suppliers.output.text",
      },
    },
  ],
};

/**
 * Built-in workflow: Content Generation
 * Generates product descriptions, critiques them, and refines.
 */
export const contentGenerationWorkflow: WorkflowDefinition = {
  id: "content-generation",
  name: "Content Generation",
  description: "Generate product descriptions, critique quality, and refine content",
  version: "1.0.0",
  tags: ["content", "marketing", "ecommerce"],
  enabled: true,
  nodes: [
    {
      id: "generate",
      name: "Generate Description",
      type: "mini-ai",
      miniAIId: "summarizer",
      inputMapping: {
        text: "input.productDetails",
      },
    },
    {
      id: "critique",
      name: "Critique Content",
      type: "mini-ai",
      miniAIId: "critic",
      inputMapping: {
        text: "generate.output.text",
      },
    },
    {
      id: "refine",
      name: "Refine Description",
      type: "mini-ai",
      miniAIId: "summarizer",
      inputMapping: {
        text: "generate.output.text",
      },
    },
  ],
};

/**
 * Built-in workflow: Market Analysis
 * Researches market, analyzes competition, and scores opportunities.
 */
export const marketAnalysisWorkflow: WorkflowDefinition = {
  id: "market-analysis",
  name: "Market Analysis",
  description: "Research market trends, analyze competition, and score opportunities",
  version: "1.0.0",
  tags: ["market", "analysis", "ecommerce"],
  enabled: true,
  nodes: [
    {
      id: "research-market",
      name: "Research Market",
      type: "mini-ai",
      miniAIId: "researcher",
      inputMapping: {
        query: "input.niche",
      },
    },
    {
      id: "classify-trends",
      name: "Classify Trends",
      type: "mini-ai",
      miniAIId: "classifier",
      inputMapping: {
        text: "research-market.output.text",
      },
    },
    {
      id: "extract-metrics",
      name: "Extract Metrics",
      type: "mini-ai",
      miniAIId: "extractor",
      inputMapping: {
        text: "research-market.output.text",
      },
    },
  ],
};

/**
 * All built-in workflows.
 */
export const builtinWorkflows: WorkflowDefinition[] = [
  productResearchWorkflow,
  supplierEvaluationWorkflow,
  contentGenerationWorkflow,
  marketAnalysisWorkflow,
];

/**
 * Bootstrap all built-in workflows.
 * Registers definitions with the workflow registry.
 *
 * Call once at application startup (e.g., from src/lib/ai/bootstrap.ts).
 */
export async function bootstrapWorkflows(): Promise<void> {
  const registry = getWorkflowRegistry();
  await registry.registerAll(builtinWorkflows);
  logger.info(`[Workflow Bootstrap] Registered ${builtinWorkflows.length} built-in workflows`);
}
