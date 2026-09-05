// Agent Registry Tests — Hierarchy

import { describe, it, expect, beforeEach } from "vitest";
import { AgentRegistry } from "./registry";
import type { AgentMetadata } from "./types";
import { BaseAgent } from "./agent";
import type { AgentContext, AgentResult } from "./types";

// Helper to create a minimal agent for testing
function createTestAgent(metadata: AgentMetadata): BaseAgent {
  const agent = {
    metadata,
 
    execute: async (_context: AgentContext): Promise<AgentResult> => ({
      success: true,
      output: "test",
      errors: [],
      metadata: {
        providerUsed: "gemini" as const,
        modelUsed: "test",
        inputTokens: 0,
        outputTokens: 0,
        durationMs: 0,
        cached: false,
      },
    }),
    validateInput: () => [],
    getCapabilities: () => metadata.capabilities,
    isEnabled: () => metadata.enabled && metadata.status === "ready",
  };
  return agent as unknown as BaseAgent;
}

// ============================================
// HIERARCHY DATA
// ============================================

const ceoMetadata: AgentMetadata = {
  id: "ceo",
  name: "CEO",
  description: "Chief Executive Officer",
  status: "ready",
  enabled: true,
  version: "1.0.0",
  capabilities: ["orchestration"],
  agentType: "executive",
  department: "executive",
};

const productHunterMetadata: AgentMetadata = {
  id: "product-hunter",
  name: "Product Hunter",
  description: "Finds products",
  status: "ready",
  enabled: true,
  version: "1.0.0",
  capabilities: ["product_analysis"],
  parentAgentId: "ceo",
  agentType: "department",
  department: "product",
};

const marketResearchMetadata: AgentMetadata = {
  id: "market-research",
  name: "Market Research",
  description: "Analyzes markets",
  status: "ready",
  enabled: true,
  version: "1.0.0",
  capabilities: ["market_analysis"],
  parentAgentId: "product-hunter",
  agentType: "specialist",
  department: "product",
};

const supplierResearchMetadata: AgentMetadata = {
  id: "supplier-research",
  name: "Supplier Research",
  description: "Finds suppliers",
  status: "ready",
  enabled: true,
  version: "1.0.0",
  capabilities: ["supplier_analysis"],
  parentAgentId: "product-hunter",
  agentType: "specialist",
  department: "product",
};

const marketingMetadata: AgentMetadata = {
  id: "marketing",
  name: "Marketing",
  description: "Marketing agent",
  status: "ready",
  enabled: true,
  version: "1.0.0",
  capabilities: ["content_generation"],
  parentAgentId: "ceo",
  agentType: "department",
  department: "marketing",
};

// ============================================
// TESTS
// ============================================

describe("AgentRegistry — Hierarchy", () => {
  let registry: AgentRegistry;

  beforeEach(() => {
    registry = new AgentRegistry();
    registry.register(createTestAgent(ceoMetadata));
    registry.register(createTestAgent(productHunterMetadata));
    registry.register(createTestAgent(marketResearchMetadata));
    registry.register(createTestAgent(supplierResearchMetadata));
    registry.register(createTestAgent(marketingMetadata));
  });

  // --- Parent/Child ---

  describe("getParent", () => {
    it("should return parent of product-hunter", () => {
      const parent = registry.getParent("product-hunter");
      expect(parent).toBeDefined();
      expect(parent!.id).toBe("ceo");
    });

    it("should return parent of market-research", () => {
      const parent = registry.getParent("market-research");
      expect(parent).toBeDefined();
      expect(parent!.id).toBe("product-hunter");
    });

    it("should return undefined for CEO (no parent)", () => {
      const parent = registry.getParent("ceo");
      expect(parent).toBeUndefined();
    });

    it("should return undefined for unknown agent", () => {
      const parent = registry.getParent("unknown");
      expect(parent).toBeUndefined();
    });
  });

  describe("getChildren", () => {
    it("should return direct children of CEO", () => {
      const children = registry.getChildren("ceo");
      expect(children).toHaveLength(2);
      const ids = children.map((c) => c.id).sort();
      expect(ids).toEqual(["marketing", "product-hunter"]);
    });

    it("should return direct children of product-hunter", () => {
      const children = registry.getChildren("product-hunter");
      expect(children).toHaveLength(2);
      const ids = children.map((c) => c.id).sort();
      expect(ids).toEqual(["market-research", "supplier-research"]);
    });

    it("should return empty array for leaf agents", () => {
      const children = registry.getChildren("market-research");
      expect(children).toHaveLength(0);
    });

    it("should return empty array for unknown agent", () => {
      const children = registry.getChildren("unknown");
      expect(children).toHaveLength(0);
    });
  });

  // --- Recursive descendants ---

  describe("getDescendants", () => {
    it("should return all descendants of CEO", () => {
      const descendants = registry.getDescendants("ceo");
      expect(descendants).toHaveLength(4);
      const ids = descendants.map((d) => d.id).sort();
      expect(ids).toEqual([
        "market-research",
        "marketing",
        "product-hunter",
        "supplier-research",
      ]);
    });

    it("should return all descendants of product-hunter", () => {
      const descendants = registry.getDescendants("product-hunter");
      expect(descendants).toHaveLength(2);
      const ids = descendants.map((d) => d.id).sort();
      expect(ids).toEqual(["market-research", "supplier-research"]);
    });

    it("should return empty array for leaf agents", () => {
      const descendants = registry.getDescendants("market-research");
      expect(descendants).toHaveLength(0);
    });
  });

  // --- Chain (ancestors) ---

  describe("getChain", () => {
    it("should return chain from market-research to CEO", () => {
      const chain = registry.getChain("market-research");
      expect(chain).toHaveLength(3);
      expect(chain.map((a) => a.id)).toEqual([
        "market-research",
        "product-hunter",
        "ceo",
      ]);
    });

    it("should return chain from product-hunter to CEO", () => {
      const chain = registry.getChain("product-hunter");
      expect(chain).toHaveLength(2);
      expect(chain.map((a) => a.id)).toEqual(["product-hunter", "ceo"]);
    });

    it("should return single-element chain for CEO", () => {
      const chain = registry.getChain("ceo");
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe("ceo");
    });
  });

  // --- Type/Department filters ---

  describe("listByType", () => {
    it("should return all executive agents", () => {
      const executives = registry.listByType("executive");
      expect(executives).toHaveLength(1);
      expect(executives[0].id).toBe("ceo");
    });

    it("should return all department agents", () => {
      const departments = registry.listByType("department");
      expect(departments).toHaveLength(2);
      const ids = departments.map((d) => d.id).sort();
      expect(ids).toEqual(["marketing", "product-hunter"]);
    });

    it("should return all specialist agents", () => {
      const specialists = registry.listByType("specialist");
      expect(specialists).toHaveLength(2);
      const ids = specialists.map((s) => s.id).sort();
      expect(ids).toEqual(["market-research", "supplier-research"]);
    });
  });

  describe("listByDepartment", () => {
    it("should return all product agents", () => {
      const productAgents = registry.listByDepartment("product");
      expect(productAgents).toHaveLength(3);
      const ids = productAgents.map((a) => a.id).sort();
      expect(ids).toEqual(["market-research", "product-hunter", "supplier-research"]);
    });

    it("should return all marketing agents", () => {
      const marketingAgents = registry.listByDepartment("marketing");
      expect(marketingAgents).toHaveLength(1);
      expect(marketingAgents[0].id).toBe("marketing");
    });

    it("should return empty for non-existent department", () => {
      const agents = registry.listByDepartment("finance");
      expect(agents).toHaveLength(0);
    });
  });

  // --- Root ---

  describe("getRoot", () => {
    it("should return CEO as root", () => {
      const root = registry.getRoot();
      expect(root).toBeDefined();
      expect(root!.id).toBe("ceo");
    });
  });

  // --- Tree ---

  describe("getTree", () => {
    it("should build tree with CEO as root", () => {
      const tree = registry.getTree() as (AgentMetadata & { children: AgentMetadata[] }) | undefined;
      expect(tree).toBeDefined();
      expect(tree!.id).toBe("ceo");
      expect(tree!.children).toHaveLength(2);

      const productHunter = tree!.children.find((c) => c.id === "product-hunter") as AgentMetadata & { children: AgentMetadata[] };
      expect(productHunter).toBeDefined();
      expect(productHunter.children).toHaveLength(2);

      const marketing = tree!.children.find((c) => c.id === "marketing") as AgentMetadata & { children: AgentMetadata[] };
      expect(marketing).toBeDefined();
      expect(marketing.children).toHaveLength(0);
    });
  });

  // --- Workspace filtering ---

  describe("listByWorkspace", () => {
    it("should return global agents when workspaceId is null", () => {
      const global = registry.listByWorkspace(null);
      expect(global).toHaveLength(5); // All agents are global (no workspaceId set)
    });

    it("should return all agents for specific workspace (all are global)", () => {
      const ws = registry.listByWorkspace("ws-default");
      expect(ws).toHaveLength(5);
    });
  });
});
