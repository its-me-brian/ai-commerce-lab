// Source Type Manager
// Marks and tracks whether data comes from real APIs or mock sources.
// FASE 25: Ensures transparency — users always know if data is real or simulated.

import { z } from "zod";

// --- Zod Schemas ---

export const SourceTypeSchema = z.enum(["mock", "real", "hybrid"]);
export type SourceType = z.infer<typeof SourceTypeSchema>;

export const DataSourceSchema = z.object({
  /** Unique identifier for this data source */
  id: z.string(),
  /** Human-readable name */
  name: z.string(),
  /** Source type */
  type: SourceTypeSchema,
  /** Provider/platform name (e.g., "eBay API", "AliExpress", "FakeStore") */
  provider: z.string(),
  /** Whether this source is currently active */
  active: z.boolean().optional().default(true),
  /** When this source was last used */
  lastUsedAt: z.string().datetime().optional(),
  /** Total records retrieved from this source */
  totalRecords: z.number().min(0).optional().default(0),
  /** Success rate (0-1) */
  successRate: z.number().min(0).max(1).optional().default(1.0),
  /** Average response time in ms */
  avgResponseTimeMs: z.number().min(0).optional(),
  /** Notes about this source */
  notes: z.string().optional(),
});

export type DataSource = z.infer<typeof DataSourceSchema>;

/** Input type for registerSource (all fields with defaults are optional) */
export type DataSourceInput = {
  id: string;
  name: string;
  type: SourceType;
  provider: string;
  active?: boolean;
  lastUsedAt?: string;
  totalRecords?: number;
  successRate?: number;
  avgResponseTimeMs?: number;
  notes?: string;
};

/** Provenance metadata for tracing data origin */
export const DataProvenanceSchema = z.object({
  sourceId: z.string(),
  sourceType: SourceTypeSchema,
  collectedAt: z.string().datetime(),
  verified: z.boolean().optional().default(false),
  confidence: z.number().min(0).max(100).optional(),
  transformations: z.array(z.string()).optional(),
});

export type DataProvenance = z.infer<typeof DataProvenanceSchema>;

/**
 * Source Type Manager
 * Tracks and manages data sources, ensuring transparency about data origin.
 */
export class SourceTypeManager {
  private sources: Map<string, DataSource> = new Map();

  constructor() {
    // Register real data sources
    this.registerSource({
      id: "ebay-browse",
      name: "eBay Browse API",
      type: "real",
      provider: "eBay",
      notes: "Real eBay product listings",
    });

    this.registerSource({
      id: "aliexpress",
      name: "AliExpress",
      type: "real",
      provider: "AliExpress",
      notes: "Real AliExpress supplier data",
    });
  }

  /**
   * Register a new data source.
   */
  registerSource(input: DataSourceInput): void {
    // Apply defaults
    const source: DataSource = {
      ...input,
      active: input.active ?? true,
      totalRecords: input.totalRecords ?? 0,
      successRate: input.successRate ?? 1.0,
    };
    this.sources.set(source.id, source);
  }

  /**
   * Get a data source by ID.
   */
  getSource(sourceId: string): DataSource | undefined {
    return this.sources.get(sourceId);
  }

  /**
   * List all registered sources.
   */
  listSources(): DataSource[] {
    return Array.from(this.sources.values());
  }

  /**
   * List sources by type.
   */
  listByType(type: SourceType): DataSource[] {
    return this.listSources().filter((s) => s.type === type);
  }

  /**
   * List only real sources.
   */
  listRealSources(): DataSource[] {
    return this.listByType("real");
  }

  /**
   * List only mock sources.
   */
  listMockSources(): DataSource[] {
    return this.listByType("mock");
  }

  /**
   * Mark a source as used (updates stats).
   */
  markUsed(sourceId: string, success: boolean, responseTimeMs?: number): void {
    const source = this.sources.get(sourceId);
    if (!source) return;

    source.lastUsedAt = new Date().toISOString();
    source.totalRecords = (source.totalRecords || 0) + 1;

    // Update success rate (rolling average)
    const alpha = 0.1; // Smoothing factor
    source.successRate = (source.successRate || 1.0) * (1 - alpha) + (success ? 1 : 0) * alpha;

    // Update response time
    if (responseTimeMs !== undefined) {
      if (source.avgResponseTimeMs === undefined) {
        source.avgResponseTimeMs = responseTimeMs;
      } else {
        source.avgResponseTimeMs =
          source.avgResponseTimeMs * (1 - alpha) + responseTimeMs * alpha;
      }
    }
  }

  /**
   * Create provenance metadata for a data point.
   */
  createProvenance(
    sourceId: string,
    options?: {
      verified?: boolean;
      confidence?: number;
      transformations?: string[];
    }
  ): DataProvenance {
    const source = this.sources.get(sourceId);
    if (!source) {
      return {
        sourceId,
        sourceType: "mock" as const,
        collectedAt: new Date().toISOString(),
        verified: false,
        confidence: 0,
        transformations: options?.transformations,
      };
    }
    const sourceType = source.type;

    return {
      sourceId,
      sourceType,
      collectedAt: new Date().toISOString(),
      verified: options?.verified || false,
      confidence: options?.confidence || (sourceType === "real" ? 80 : 50),
      transformations: options?.transformations,
    };
  }

  /**
   * Check if a data point is from a real source.
   */
  isRealSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    return source?.type === "real";
  }

  /**
   * Check if a data point is from a mock source.
   */
  isMockSource(sourceId: string): boolean {
    const source = this.sources.get(sourceId);
    return source?.type === "mock";
  }

  /**
   * Get source type summary for display.
   */
  getSourceSummary(): {
    total: number;
    real: number;
    mock: number;
    hybrid: number;
    activeReal: number;
  } {
    const sources = this.listSources();
    return {
      total: sources.length,
      real: sources.filter((s) => s.type === "real").length,
      mock: sources.filter((s) => s.type === "mock").length,
      hybrid: sources.filter((s) => s.type === "hybrid").length,
      activeReal: sources.filter((s) => s.type === "real" && s.active).length,
    };
  }

  /**
   * Validate that an output has proper source marking.
   */
  validateSourceMarking(output: {
    sourceType?: string;
    source?: string;
    dataSource?: string;
  }): { valid: boolean; warnings: string[] } {
    const warnings: string[] = [];

    if (!output.sourceType) {
      warnings.push("Missing sourceType field — data origin unknown");
    }

    if (!output.source && !output.dataSource) {
      warnings.push("Missing source/dataSource field — cannot trace data origin");
    }

    // Check if claimed real source exists
    if (output.sourceType === "real" && output.source) {
      const source = this.sources.get(output.source);
      if (!source) {
        warnings.push(`Claimed real source '${output.source}' not registered`);
      } else if (source.type !== "real") {
        warnings.push(`Source '${output.source}' is registered as ${source.type}, not real`);
      }
    }

    return {
      valid: warnings.length === 0,
      warnings,
    };
  }
}

// Singleton
let instance: SourceTypeManager | null = null;

export function getSourceTypeManager(): SourceTypeManager {
  if (!instance) {
    instance = new SourceTypeManager();
  }
  return instance;
}
