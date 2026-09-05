import { describe, it, expect } from "vitest";
import { AgentPromptBuilder, getPromptBuilder } from "./prompt-builder";
import { productHunterDefinition } from "../definitions/product-hunter";
import { storeBuilderDefinition } from "../definitions/store-builder";
import { marketingDefinition } from "../definitions/marketing";
import { secretaryDefinition } from "../definitions/secretary";
import { financeDefinition } from "../definitions/finance";
import { ceoDefinition } from "../definitions/ceo";
/* eslint-disable @typescript-eslint/no-unused-vars */
import {
  agentDefinitions,
  getAgentDefinition,
  listAgentDefinitions,
} from "../definitions";
/* eslint-enable @typescript-eslint/no-unused-vars */

describe("AgentPromptBuilder", () => {
  const builder = new AgentPromptBuilder();

  it("should build system prompt from definition", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.systemPrompt).toBeDefined();
    expect(typeof result.systemPrompt).toBe("string");
    expect(result.systemPrompt.length).toBeGreaterThan(0);
  });

  it("should include identity in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.identity).toContain("Product Hunter");
    expect(result.sections.identity).toContain("Senior Ecommerce Product Researcher");
  });

  it("should include mission in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.mission).toContain("Find and evaluate ecommerce product opportunities");
  });

  it("should include personality in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.personality).toContain("analytical");
    expect(result.sections.personality).toContain("skeptical");
    expect(result.sections.personality).toContain("data driven");
  });

  it("should include expertise in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.expertise).toContain("Ecommerce");
    expect(result.sections.expertise).toContain("Product research");
  });

  it("should include rules in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.rules).toContain("Never fabricate supplier information");
    expect(result.sections.rules).toContain("Never fabricate prices");
  });

  it("should include skills in prompt", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.skills).toContain("Product Discovery");
    expect(result.sections.skills).toContain("Market Analysis");
  });

  it("should include output instructions", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.sections.outputInstructions).toContain("json");
  });

  it("should produce complete prompt with all sections", () => {
    const result = builder.build({ definition: productHunterDefinition });

    expect(result.systemPrompt).toContain("# IDENTITY");
    expect(result.systemPrompt).toContain("# MISSION");
    expect(result.systemPrompt).toContain("# PERSONALITY");
    expect(result.systemPrompt).toContain("# EXPERTISE");
    expect(result.systemPrompt).toContain("# RULES");
    expect(result.systemPrompt).toContain("# SKILLS");
    expect(result.systemPrompt).toContain("# OUTPUT INSTRUCTIONS");
  });

  // FASE 3: Enhanced personality tests
  it("should include tone in personality section", () => {
    const result = builder.build({ definition: productHunterDefinition });
    expect(result.sections.personality).toContain("Tone: professional");
  });

  it("should include values in personality section", () => {
    const result = builder.build({ definition: productHunterDefinition });
    expect(result.sections.personality).toContain("Core values:");
    expect(result.sections.personality).toContain("accuracy");
  });

  it("should include personality constraints", () => {
    const result = builder.build({ definition: productHunterDefinition });
    expect(result.sections.personality).toContain("Personality constraints:");
    expect(result.sections.personality).toContain("Never present estimates as confirmed data");
  });

  it("should use customInstructions when provided", () => {
    const customDef = {
      ...productHunterDefinition,
      personality: {
        ...productHunterDefinition.personality,
        customInstructions: "You are a pirate. Always talk like a pirate.",
      },
    };
    const result = builder.build({ definition: customDef });
    expect(result.sections.personality).toContain("pirate");
    expect(result.sections.personality).not.toContain("analytical");
  });

  it("should apply workspace personality overrides", () => {
    const result = builder.build({
      definition: productHunterDefinition,
      additionalContext: {
        personalityOverrides: {
          tone: "casual",
          values: ["speed", "efficiency"],
        },
      },
    });
    expect(result.sections.personality).toContain("Tone: casual");
    expect(result.sections.personality).toContain("Core values: speed, efficiency");
    // Original traits should still be present
    expect(result.sections.personality).toContain("analytical");
  });
});

describe("Agent Definitions", () => {
  it("should have all 9 definitions", () => {
    const definitions = listAgentDefinitions();
    expect(definitions).toHaveLength(9);
  });

  it("should retrieve definition by slug", () => {
    const ph = getAgentDefinition("product-hunter");
    expect(ph).toBeDefined();
    expect(ph?.id).toBe("product-hunter");
  });

  it("should return undefined for unknown slug", () => {
    const unknown = getAgentDefinition("unknown-agent");
    expect(unknown).toBeUndefined();
  });

  it("Product Hunter should have full definition", () => {
    const ph = getAgentDefinition("product-hunter");
    expect(ph).toBeDefined();
    expect(ph?.identity.name).toBe("Product Hunter");
    expect(ph?.identity.role).toBe("Senior Ecommerce Product Researcher");
    expect(ph?.mission).toContain("ecommerce product opportunities");
    expect(ph?.personality.traits.length).toBeGreaterThan(0);
    expect(ph?.expertise.length).toBeGreaterThan(0);
    expect(ph?.rules.length).toBeGreaterThan(0);
    expect(ph?.skills.length).toBeGreaterThan(0);
    expect(ph?.status).toBe("ready");
  });

  it("All agents should be ready or active", () => {
    expect(storeBuilderDefinition.status).toBe("ready");
    expect(marketingDefinition.status).toBe("ready");
    expect(secretaryDefinition.status).toBe("ready");
    expect(financeDefinition.status).toBe("ready");
    expect(ceoDefinition.status).toBe("ready");
  });

  it("All definitions should have valid structure", () => {
    for (const def of listAgentDefinitions()) {
      expect(def.id).toBeDefined();
      expect(def.slug).toBeDefined();
      expect(def.identity).toBeDefined();
      expect(def.identity.name).toBeDefined();
      expect(def.identity.role).toBeDefined();
      expect(def.mission).toBeDefined();
      expect(def.personality).toBeDefined();
      expect(Array.isArray(def.personality.traits)).toBe(true);
      expect(Array.isArray(def.expertise)).toBe(true);
      expect(Array.isArray(def.rules)).toBe(true);
      expect(Array.isArray(def.skills)).toBe(true);
    }
  });
});

describe("Skill Assignment", () => {
  it("Product Hunter should have 6 skills", () => {
    const ph = getAgentDefinition("product-hunter");
    expect(ph?.skills).toHaveLength(6);
    expect(ph?.skills).toContain("product-discovery");
    expect(ph?.skills).toContain("supplier-research");
    expect(ph?.skills).toContain("market-analysis");
    expect(ph?.skills).toContain("competitor-analysis");
    expect(ph?.skills).toContain("pricing-analysis");
    expect(ph?.skills).toContain("profitability-analysis");
  });

  it("Marketing should share competitor-analysis skill with Product Hunter", () => {
    const ph = getAgentDefinition("product-hunter");
    const mkt = getAgentDefinition("marketing");

    const shared = ph?.skills.filter((s) => mkt?.skills.includes(s));
    expect(shared).toContain("competitor-analysis");
  });

  it("CEO should have strategic skills", () => {
    const ceo = getAgentDefinition("ceo");
    expect(ceo?.skills).toContain("strategic-planning");
    expect(ceo?.skills).toContain("task-delegation");
    expect(ceo?.skills).toContain("decision-making");
  });
});

describe("Singleton", () => {
  it("should return same instance", () => {
    const b1 = getPromptBuilder();
    const b2 = getPromptBuilder();
    expect(b1).toBe(b2);
  });
});
