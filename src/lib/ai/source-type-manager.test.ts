// Source Type Manager Tests

import { describe, it, expect, beforeEach } from "vitest";
import { SourceTypeManager } from "./source-type-manager";

describe("SourceTypeManager", () => {
  let manager: SourceTypeManager;

  beforeEach(() => {
    manager = new SourceTypeManager();
  });

  it("should create an instance", () => {
    expect(manager).toBeDefined();
    expect(manager).toBeInstanceOf(SourceTypeManager);
  });

  describe("registerSource", () => {
    it("should register a new source", () => {
      manager.registerSource({
        id: "test-source",
        name: "Test Source",
        type: "mock",
        provider: "Test",
      });

      const source = manager.getSource("test-source");
      expect(source).toBeDefined();
      expect(source?.name).toBe("Test Source");
    });

    it("should overwrite existing source", () => {
      manager.registerSource({
        id: "test",
        name: "Original",
        type: "mock",
        provider: "Test",
      });

      manager.registerSource({
        id: "test",
        name: "Updated",
        type: "real",
        provider: "Test",
      });

      const source = manager.getSource("test");
      expect(source?.name).toBe("Updated");
    });
  });

  describe("listSources", () => {
    it("should list all sources", () => {
      const sources = manager.listSources();
      expect(sources.length).toBeGreaterThan(0);
    });

    it("should include default mock sources", () => {
      const sources = manager.listSources();
      expect(sources.some((s) => s.id === "fakestore")).toBe(true);
      expect(sources.some((s) => s.id === "dummyjson")).toBe(true);
    });

    it("should include default real sources", () => {
      const sources = manager.listSources();
      expect(sources.some((s) => s.id === "ebay-browse")).toBe(true);
    });
  });

  describe("listByType", () => {
    it("should filter sources by type", () => {
      const mockSources = manager.listByType("mock");
      expect(mockSources.every((s) => s.type === "mock")).toBe(true);

      const realSources = manager.listByType("real");
      expect(realSources.every((s) => s.type === "real")).toBe(true);
    });
  });

  describe("listRealSources", () => {
    it("should return only real sources", () => {
      const real = manager.listRealSources();
      expect(real.every((s) => s.type === "real")).toBe(true);
    });
  });

  describe("listMockSources", () => {
    it("should return only mock sources", () => {
      const mock = manager.listMockSources();
      expect(mock.every((s) => s.type === "mock")).toBe(true);
    });
  });

  describe("markUsed", () => {
    it("should update source stats on use", () => {
      manager.registerSource({
        id: "test",
        name: "Test",
        type: "mock",
        provider: "Test",
      });

      manager.markUsed("test", true, 100);

      const source = manager.getSource("test");
      expect(source?.totalRecords).toBe(1);
      expect(source?.lastUsedAt).toBeDefined();
    });

    it("should update success rate", () => {
      manager.registerSource({
        id: "test",
        name: "Test",
        type: "mock",
        provider: "Test",
      });

      // First use: success
      manager.markUsed("test", true);
      const source1 = manager.getSource("test");
      expect(source1?.successRate).toBeGreaterThan(0.9);

      // Second use: failure
      manager.markUsed("test", false);
      const source2 = manager.getSource("test");
      expect(source2?.successRate).toBeLessThan(1);
    });
  });

  describe("createProvenance", () => {
    it("should create provenance for a source", () => {
      const provenance = manager.createProvenance("fakestore");

      expect(provenance.sourceId).toBe("fakestore");
      expect(provenance.sourceType).toBe("mock");
      expect(provenance.collectedAt).toBeDefined();
    });

    it("should use source type from registered source", () => {
      const provenance = manager.createProvenance("ebay-browse");

      expect(provenance.sourceType).toBe("real");
    });

    it("should accept custom options", () => {
      const provenance = manager.createProvenance("fakestore", {
        verified: true,
        confidence: 90,
        transformations: ["normalized", "deduplicated"],
      });

      expect(provenance.verified).toBe(true);
      expect(provenance.confidence).toBe(90);
      expect(provenance.transformations).toHaveLength(2);
    });
  });

  describe("isRealSource / isMockSource", () => {
    it("should correctly identify real sources", () => {
      expect(manager.isRealSource("ebay-browse")).toBe(true);
      expect(manager.isMockSource("ebay-browse")).toBe(false);
    });

    it("should correctly identify mock sources", () => {
      expect(manager.isMockSource("fakestore")).toBe(true);
      expect(manager.isRealSource("fakestore")).toBe(false);
    });
  });

  describe("getSourceSummary", () => {
    it("should return correct summary", () => {
      const summary = manager.getSourceSummary();

      expect(summary.total).toBeGreaterThan(0);
      expect(summary.real).toBeGreaterThan(0);
      expect(summary.mock).toBeGreaterThan(0);
      expect(summary.total).toBe(summary.real + summary.mock + summary.hybrid);
    });
  });

  describe("validateSourceMarking", () => {
    it("should validate proper source marking", () => {
      const result = manager.validateSourceMarking({
        sourceType: "mock",
        source: "fakestore",
      });

      expect(result.valid).toBe(true);
      expect(result.warnings).toHaveLength(0);
    });

    it("should warn when sourceType is missing", () => {
      const result = manager.validateSourceMarking({
        source: "fakestore",
      });

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes("sourceType"))).toBe(true);
    });

    it("should warn when source is missing", () => {
      const result = manager.validateSourceMarking({
        sourceType: "mock",
      });

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes("source"))).toBe(true);
    });

    it("should warn when claimed real source is not registered", () => {
      const result = manager.validateSourceMarking({
        sourceType: "real",
        source: "nonexistent-api",
      });

      expect(result.valid).toBe(false);
      expect(result.warnings.some((w) => w.includes("not registered"))).toBe(true);
    });
  });
});
