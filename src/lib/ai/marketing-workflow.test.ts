// Marketing Workflow Tests
// FASE 30: Marketing campaign creation pipeline.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { MarketingWorkflow }from "./marketing-workflow";

// Mock MarketingAgent
vi.mock("../agents/marketing", () => {
  const mockExecute = vi.fn().mockResolvedValue({
    success: true,
    output: "Marketing content generated",
    structuredData: {
      hooks: [
        { text: "Discover the future of tech", platform: "all", style: "curiosity" },
      ],
      adCopy: {
        headline: "Revolutionary Product",
        primaryText: "Experience innovation like never before.",
        description: "The product you've been waiting for.",
        callToAction: "Buy Now",
      },
      emailSequence: [
        {
          subject: "Welcome!",
          previewText: "Check out our new product",
          body: "Hi {{name}}, welcome to our store.",
          purpose: "welcome",
        },
      ],
      socialPosts: [
        {
          platform: "instagram",
          content: "Exciting new product launch!",
          hashtags: ["#newproduct", "#tech"],
          bestTime: "6-8 PM",
        },
      ],
      campaignStrategy: {
        name: "Spring Launch",
        objective: "Drive sales",
        budget: "500",
        duration: "2 weeks",
        targetAudience: "Tech enthusiasts",
        kpis: ["ROAS > 3", "CTR > 2%"],
      },
    },
    reasoningSummary: "Generated marketing campaign: Spring Launch",
    errors: [],
    metadata: {
      providerUsed: "openai",
      modelUsed: "gpt-4o-mini",
      inputTokens: 500,
      outputTokens: 1500,
      durationMs: 3000,
      cached: false,
    },
  });

  return {
    MarketingAgent: vi.fn().mockImplementation(function () {
      return { execute: mockExecute };
    }),
    __mockExecute: mockExecute,
  };
});

// Mock ApprovalManager
vi.mock("./approval-manager", () => ({
  getApprovalManager: () => ({
    createApproval: vi.fn().mockResolvedValue({ id: "ap-mkt-1" }),
  }),
}));

describe("MarketingWorkflow", () => {
  let workflow: MarketingWorkflow;

  beforeEach(() => {
    vi.clearAllMocks();
    workflow = new MarketingWorkflow();
  });

  describe("execute", () => {
    it("should execute full workflow with content", async () => {
      const result = await workflow.execute({
        productName: "Wireless Mouse",
        targetAudience: "Remote workers",
      });

      expect(result.workflowId).toMatch(/^mw-/);
      expect(result.completedSteps).toContain("research");
      expect(result.completedSteps).toContain("strategy");
      expect(result.completedSteps).toContain("content_creation");
      expect(result.content).toBeDefined();
      expect(result.content?.hooks.length).toBeGreaterThan(0);
      expect(result.content?.adCopy.headline).toBeTruthy();
      expect(result.content?.campaignStrategy.name).toBeTruthy();
    });

    it("should track token usage", async () => {
      const result = await workflow.execute({
        productName: "Test Product",
        targetAudience: "Test audience",
      });

      expect(result.tokenUsage.inputTokens).toBe(500);
      expect(result.tokenUsage.outputTokens).toBe(1500);
    });

    it("should require approval for high budget", async () => {
      const result = await workflow.execute({
        productName: "Expensive Product",
        targetAudience: "Everyone",
        budget: "5000",
      });

      expect(result.requiresApproval).toBe(true);
      expect(result.approvalId).toBe("ap-mkt-1");
      expect(result.currentStep).toBe("review");
    });

    it("should not require approval for low budget", async () => {
      const result = await workflow.execute({
        productName: "Cheap Product",
        targetAudience: "Students",
        budget: "50",
      });

      expect(result.requiresApproval).toBe(false);
      expect(result.approvalId).toBeNull();
    });

    it("should handle agent failure gracefully", async () => {
      const mod = await import("../agents/marketing") as Record<string, unknown>;
      const mockFn = mod.__mockExecute as ReturnType<typeof vi.fn>;
      mockFn.mockResolvedValueOnce({
        success: false,
        output: "",
        structuredData: null,
        errors: ["API rate limit exceeded"],
        metadata: { inputTokens: 0, outputTokens: 0, durationMs: 0 },
      });

      const result = await workflow.execute({
        productName: "Test",
        targetAudience: "Test",
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.content).toBeNull();
    });

    it("should handle agent throw gracefully", async () => {
      const mod = await import("../agents/marketing") as Record<string, unknown>;
      const mockFn = mod.__mockExecute as ReturnType<typeof vi.fn>;
      mockFn.mockRejectedValueOnce(new Error("Network error"));

      const result = await workflow.execute({
        productName: "Test",
        targetAudience: "Test",
      });

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain("Network error");
    });
  });

  describe("assessRisk", () => {
    it("should return critical for very high budget", async () => {
      const result = await workflow.execute({
        productName: "Test",
        targetAudience: "Test",
        budget: "25000",
      });

      expect(result.requiresApproval).toBe(true);
    });

    it("should return low for no budget", async () => {
      const result = await workflow.execute({
        productName: "Test",
        targetAudience: "Test",
      });

      expect(result.requiresApproval).toBe(false);
    });
  });

  describe("getStatus", () => {
    it("should return workflow steps", () => {
      const status = workflow.getStatus();

      expect(status.currentStep).toBe("research");
      expect(status.steps).toEqual([
        "research",
        "strategy",
        "content_creation",
        "review",
        "approved",
        "launched",
      ]);
    });
  });

  describe("content quality", () => {
    it("should generate complete ad copy", async () => {
      const result = await workflow.execute({
        productName: "Ergonomic Chair",
        targetAudience: "Office workers",
      });

      expect(result.content?.adCopy.headline).toBeTruthy();
      expect(result.content?.adCopy.primaryText).toBeTruthy();
      expect(result.content?.adCopy.description).toBeTruthy();
      expect(result.content?.adCopy.callToAction).toBeTruthy();
    });

    it("should generate social posts for multiple platforms", async () => {
      const result = await workflow.execute({
        productName: "Smart Watch",
        targetAudience: "Fitness enthusiasts",
      });

      expect(result.content?.socialPosts.length).toBeGreaterThan(0);
    });

    it("should generate email sequence", async () => {
      const result = await workflow.execute({
        productName: "Online Course",
        targetAudience: "Students",
      });

      expect(result.content?.emailSequence.length).toBeGreaterThan(0);
      expect(result.content?.emailSequence[0].purpose).toBe("welcome");
    });

    it("should include campaign KPIs", async () => {
      const result = await workflow.execute({
        productName: "SaaS Tool",
        targetAudience: "Developers",
      });

      expect(result.content?.campaignStrategy.kpis.length).toBeGreaterThan(0);
    });
  });
});
