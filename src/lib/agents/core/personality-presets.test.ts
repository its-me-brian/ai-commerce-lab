// Personality Presets Tests

import { describe, it, expect } from "vitest";
import {
  personalityPresets,
  getPersonalityPreset,
  listPersonalityPresets,
  mergePersonalities,
  ANALYTICAL_STRICT,
  FRIENDLY_CREATIVE,
} from "./personality-presets";
import type { Personality } from "./types-agent-definition";

describe("Personality Presets", () => {
  it("should have 6 presets", () => {
    const presets = listPersonalityPresets();
    expect(presets).toHaveLength(6);
  });

  it("should retrieve preset by id", () => {
    const preset = getPersonalityPreset("analytical-strict");
    expect(preset).toBeDefined();
    expect(preset?.id).toBe("analytical-strict");
    expect(preset?.name).toBe("Analytical & Strict");
  });

  it("should return undefined for unknown preset", () => {
    const preset = getPersonalityPreset("unknown");
    expect(preset).toBeUndefined();
  });

  it("all presets should have valid structure", () => {
    for (const preset of listPersonalityPresets()) {
      expect(preset.id).toBeDefined();
      expect(preset.name).toBeDefined();
      expect(preset.description).toBeDefined();
      expect(preset.personality).toBeDefined();
      expect(Array.isArray(preset.personality.traits)).toBe(true);
      expect(Array.isArray(preset.personality.communicationStyle)).toBe(true);
      expect(preset.personality.decisionStyle).toBeDefined();
    }
  });

  it("ANALYTICAL_STRICT should have tone and values", () => {
    expect(ANALYTICAL_STRICT.personality.tone).toBe("professional");
    expect(ANALYTICAL_STRICT.personality.values).toContain("accuracy");
    expect(ANALYTICAL_STRICT.personality.constraints).toBeDefined();
    expect(ANALYTICAL_STRICT.personality.constraints!.length).toBeGreaterThan(0);
  });

  it("FRIENDLY_CREATIVE should have warm tone", () => {
    expect(FRIENDLY_CREATIVE.personality.tone).toBe("warm");
    expect(FRIENDLY_CREATIVE.personality.values).toContain("customer-first");
  });
});

describe("mergePersonalities", () => {
  const base: Personality = {
    traits: ["analytical", "skeptical"],
    communicationStyle: ["structured", "direct"],
    decisionStyle: "data-driven",
    tone: "professional",
    values: ["accuracy"],
    constraints: ["Always cite sources"],
  };

  it("should return base when overrides is null", () => {
    const result = mergePersonalities(base, null);
    expect(result).toEqual(base);
  });

  it("should return base when overrides is undefined", () => {
    const result = mergePersonalities(base, undefined);
    expect(result).toEqual(base);
  });

  it("should override traits when provided", () => {
    const overrides: Partial<Personality> = {
      traits: ["creative", "empathetic"],
    };
    const result = mergePersonalities(base, overrides);
    expect(result.traits).toEqual(["creative", "empathetic"]);
    expect(result.communicationStyle).toEqual(["structured", "direct"]); // unchanged
  });

  it("should override tone when provided", () => {
    const overrides: Partial<Personality> = { tone: "casual" };
    const result = mergePersonalities(base, overrides);
    expect(result.tone).toBe("casual");
  });

  it("should override values when provided", () => {
    const overrides: Partial<Personality> = { values: ["speed", "efficiency"] };
    const result = mergePersonalities(base, overrides);
    expect(result.values).toEqual(["speed", "efficiency"]);
  });

  it("should override constraints when provided", () => {
    const overrides: Partial<Personality> = { constraints: ["Be brief"] };
    const result = mergePersonalities(base, overrides);
    expect(result.constraints).toEqual(["Be brief"]);
  });

  it("should use customInstructions as complete override", () => {
    const overrides: Partial<Personality> = {
      customInstructions: "You are a pirate. Talk like a pirate always.",
    };
    const result = mergePersonalities(base, overrides);
    expect(result.customInstructions).toBe("You are a pirate. Talk like a pirate always.");
    // Other fields should still be from base (customInstructions doesn't clear them)
    expect(result.traits).toEqual(["analytical", "skeptical"]);
  });

  it("should override all fields when all provided", () => {
    const overrides: Partial<Personality> = {
      traits: ["creative"],
      communicationStyle: ["friendly"],
      decisionStyle: "intuitive",
      tone: "playful",
      values: ["fun"],
      constraints: ["Be entertaining"],
    };
    const result = mergePersonalities(base, overrides);
    expect(result.traits).toEqual(["creative"]);
    expect(result.communicationStyle).toEqual(["friendly"]);
    expect(result.decisionStyle).toBe("intuitive");
    expect(result.tone).toBe("playful");
    expect(result.values).toEqual(["fun"]);
    expect(result.constraints).toEqual(["Be entertaining"]);
  });
});
