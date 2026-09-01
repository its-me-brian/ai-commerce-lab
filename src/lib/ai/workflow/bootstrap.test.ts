// Workflow Bootstrap Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { getWorkflowRegistry, resetWorkflowRegistry } from "./registry";
import {
  bootstrapWorkflows,
  builtinWorkflows,
  productResearchWorkflow,
  supplierEvaluationWorkflow,
  contentGenerationWorkflow,
  marketAnalysisWorkflow,
} from "./bootstrap";

// Mock Supabase to avoid real DB calls
vi.mock("../../database/supabase", () => {
  function createMockChain() {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockResolvedValue({ data: [], error: null });
    chain.insert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.upsert = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.delete = vi.fn().mockResolvedValue({ data: null, error: null });
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockResolvedValue({ data: null, error: null });
    return chain;
  }
  return {
    supabase: {
      from: vi.fn().mockReturnValue(createMockChain()),
    },
  };
});

describe("Workflow Bootstrap", () => {
  beforeEach(() => {
    resetWorkflowRegistry();
  });

  describe("builtinWorkflows", () => {
    it("exports 4 built-in workflows", () => {
      expect(builtinWorkflows).toHaveLength(4);
    });

    it("each workflow has required fields", () => {
      for (const wf of builtinWorkflows) {
        expect(wf.id).toBeTruthy();
        expect(wf.name).toBeTruthy();
        expect(wf.description).toBeTruthy();
        expect(wf.version).toBeTruthy();
        expect(wf.nodes.length).toBeGreaterThan(0);
      }
    });

    it("all workflows are enabled", () => {
      for (const wf of builtinWorkflows) {
        expect(wf.enabled).toBe(true);
      }
    });
  });

  describe("productResearchWorkflow", () => {
    it("has correct structure", () => {
      expect(productResearchWorkflow.id).toBe("product-research");
      expect(productResearchWorkflow.nodes).toHaveLength(3);
      expect(productResearchWorkflow.tags).toContain("product");
    });

    it("nodes reference valid mini-AI IDs", () => {
      const miniAIIds = productResearchWorkflow.nodes
        .filter((n) => n.type === "mini-ai")
        .map((n) => n.miniAIId);

      expect(miniAIIds).toContain("researcher");
      expect(miniAIIds).toContain("classifier");
      expect(miniAIIds).toContain("extractor");
    });
  });

  describe("supplierEvaluationWorkflow", () => {
    it("has correct structure", () => {
      expect(supplierEvaluationWorkflow.id).toBe("supplier-evaluation");
      expect(supplierEvaluationWorkflow.nodes).toHaveLength(3);
      expect(supplierEvaluationWorkflow.tags).toContain("supplier");
    });

    it("nodes reference valid mini-AI IDs", () => {
      const miniAIIds = supplierEvaluationWorkflow.nodes
        .filter((n) => n.type === "mini-ai")
        .map((n) => n.miniAIId);

      expect(miniAIIds).toContain("researcher");
      expect(miniAIIds).toContain("validator");
      expect(miniAIIds).toContain("summarizer");
    });
  });

  describe("contentGenerationWorkflow", () => {
    it("has correct structure", () => {
      expect(contentGenerationWorkflow.id).toBe("content-generation");
      expect(contentGenerationWorkflow.nodes).toHaveLength(3);
      expect(contentGenerationWorkflow.tags).toContain("content");
    });

    it("nodes reference valid mini-AI IDs", () => {
      const miniAIIds = contentGenerationWorkflow.nodes
        .filter((n) => n.type === "mini-ai")
        .map((n) => n.miniAIId);

      expect(miniAIIds).toContain("summarizer");
      expect(miniAIIds).toContain("critic");
    });
  });

  describe("marketAnalysisWorkflow", () => {
    it("has correct structure", () => {
      expect(marketAnalysisWorkflow.id).toBe("market-analysis");
      expect(marketAnalysisWorkflow.nodes).toHaveLength(3);
      expect(marketAnalysisWorkflow.tags).toContain("market");
    });

    it("nodes reference valid mini-AI IDs", () => {
      const miniAIIds = marketAnalysisWorkflow.nodes
        .filter((n) => n.type === "mini-ai")
        .map((n) => n.miniAIId);

      expect(miniAIIds).toContain("researcher");
      expect(miniAIIds).toContain("classifier");
      expect(miniAIIds).toContain("extractor");
    });
  });

  describe("bootstrapWorkflows", () => {
    it("registers all workflows with registry", async () => {
      await bootstrapWorkflows();

      const registry = getWorkflowRegistry();
      const all = await registry.list();

      expect(all.length).toBeGreaterThanOrEqual(4);
    });

    it("is idempotent", async () => {
      await bootstrapWorkflows();
      await bootstrapWorkflows();

      const registry = getWorkflowRegistry();
      const all = await registry.list();

      // Should not duplicate
      const productResearchCount = all.filter(
        (w) => w.id === "product-research"
      ).length;
      expect(productResearchCount).toBe(1);
    });
  });
});
