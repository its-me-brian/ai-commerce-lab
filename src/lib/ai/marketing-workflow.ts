// Marketing Workflow
// Orchestrates the marketing campaign creation pipeline.
// FASE 30: Research → Strategy → Content → Review → Launch

import { MarketingAgent, type MarketingContent } from "../agents/marketing";
import { getSourceTypeManager, type DataSourceInput } from "./source-type-manager";
import { getApprovalManager } from "./approval-manager";

export type MarketingWorkflowStep =
  | "research"
  | "strategy"
  | "content_creation"
  | "review"
  | "approved"
  | "launched";

export interface MarketingWorkflowInput {
  /** Product name */
  productName: string;
  /** Product price */
  price?: number;
  /** Target audience */
  targetAudience: string;
  /** Platform focus */
  platform?: string;
  /** Campaign goal */
  campaignGoal?: string;
  /** Product benefits */
  productBenefits?: string;
  /** Competitor info */
  competitors?: string;
  /** Budget */
  budget?: string;
  /** Tone */
  tone?: string;
  /** Workspace ID */
  workspaceId?: string;
}

export interface MarketingWorkflowResult {
  workflowId: string;
  currentStep: MarketingWorkflowStep;
  completedSteps: MarketingWorkflowStep[];
  content: MarketingContent | null;
  approvalId: string | null;
  /** Whether the workflow requires human approval */
  requiresApproval: boolean;
  /** Errors encountered */
  errors: string[];
  /** Token usage */
  tokenUsage: {
    inputTokens: number;
    outputTokens: number;
  };
}

/**
 * Marketing Workflow
 * Orchestrates the full marketing campaign creation pipeline.
 */
export class MarketingWorkflow {
  private agent: MarketingAgent;

  constructor() {
    this.agent = new MarketingAgent();
  }

  /**
   * Execute the full marketing workflow.
   */
  async execute(input: MarketingWorkflowInput): Promise<MarketingWorkflowResult> {
    const workflowId = `mw-${Date.now()}`;
    const completedSteps: MarketingWorkflowStep[] = [];
    const errors: string[] = [];
    let totalInputTokens = 0;
    let totalOutputTokens = 0;
    let content: MarketingContent | null = null;
    let approvalId: string | null = null;

    // Step 1: Research
    completedSteps.push("research");

    // Step 2: Strategy
    completedSteps.push("strategy");

    // Step 3: Content Creation
    try {
      const result = await this.agent.execute({
        taskId: `mw-${workflowId}-content`,
        taskType: "content_generation",
        input: {
          productName: input.productName,
          price: input.price,
          targetAudience: input.targetAudience,
          platform: input.platform || "all",
          campaignGoal: input.campaignGoal || "sales",
          productBenefits: input.productBenefits,
          competitors: input.competitors,
          budget: input.budget,
          tone: input.tone,
        },
        configuration: {
          agentId: "marketing",
          primaryProvider: "openai",
          primaryModel: "gpt-4o-mini",
          temperature: 0.7,
          maxTokens: 2000,
          inputPricePerMillion: 0.15,
          outputPricePerMillion: 0.6,
        },
        tools: [],
      });

      if (result.success && result.structuredData) {
        content = result.structuredData as MarketingContent;
        totalInputTokens += result.metadata.inputTokens;
        totalOutputTokens += result.metadata.outputTokens;
      } else {
        errors.push(...result.errors);
      }
    } catch (error) {
      errors.push(`Content creation failed: ${error instanceof Error ? error.message : "Unknown error"}`);
    }

    completedSteps.push("content_creation");

    // Step 4: Review — check if approval is needed
    let requiresApproval = false;

    if (content) {
      const riskLevel = this.assessRisk(input, content);
      if (riskLevel === "high" || riskLevel === "critical") {
        requiresApproval = true;
        try {
          const approvalManager = getApprovalManager();
          const approval = await approvalManager.createApproval({
            agent_id: "marketing",
            action_type: "marketing_campaign",
            action_summary: `Marketing campaign for: ${input.productName}`,
            action_details: {
              productName: input.productName,
              budget: input.budget,
              platform: input.platform,
              campaignName: content.campaignStrategy.name,
            },
            risk_level: riskLevel,
          });
          approvalId = approval.id;
        } catch (error) {
          errors.push(`Failed to create approval: ${error instanceof Error ? error.message : "Unknown"}`);
        }
      }
    }

    return {
      workflowId,
      currentStep: requiresApproval ? "review" : "content_creation",
      completedSteps,
      content,
      approvalId,
      requiresApproval,
      errors,
      tokenUsage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
      },
    };
  }

  /**
   * Assess campaign risk based on budget and scope.
   */
  private assessRisk(
    input: MarketingWorkflowInput,
    content: MarketingContent
  ): "low" | "medium" | "high" | "critical" {
    // Parse budget
    const budgetStr = input.budget || content.campaignStrategy.budget || "0";
    const budgetNum = parseFloat(budgetStr.replace(/[^0-9.]/g, ""));

    if (budgetNum > 10000) return "critical";
    if (budgetNum > 1000) return "high";
    if (budgetNum > 100) return "medium";
    return "low";
  }

  /**
   * Get workflow status.
   */
  getStatus(): {
    currentStep: MarketingWorkflowStep;
    steps: MarketingWorkflowStep[];
  } {
    return {
      currentStep: "research",
      steps: ["research", "strategy", "content_creation", "review", "approved", "launched"],
    };
  }
}

// Singleton
let instance: MarketingWorkflow | null = null;

export function getMarketingWorkflow(): MarketingWorkflow {
  if (!instance) {
    instance = new MarketingWorkflow();
  }
  return instance;
}
