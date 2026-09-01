// RAG Service Tests
import { describe, it, expect, beforeEach, vi } from "vitest";
import { RAGService, type SupabaseClient, type KnowledgeDocument } from "./rag-service";

// Helper: generate same embedding the real service would
function generateTestEmbedding(text: string): number[] {
  const dim = 384;
  const vec = new Array<number>(dim).fill(0);
  const normalized = text.toLowerCase().replace(/[^\w\s]/g, " ");
  const words = normalized.split(/\s+/).filter(Boolean);
  for (const word of words) {
    let hash = 0;
    for (let j = 0; j < word.length; j++) {
      hash = ((hash << 5) - hash + word.charCodeAt(j)) | 0;
    }
    const baseIdx = Math.abs(hash) % dim;
    for (let k = -3; k <= 3; k++) {
      const idx = (baseIdx + k + dim) % dim;
      vec[idx] += 1.0 / (1 + Math.abs(k));
    }
  }
  let norm = 0;
  for (let i = 0; i < dim; i++) norm += vec[i] * vec[i];
  norm = Math.sqrt(norm) || 1;
  for (let i = 0; i < dim; i++) vec[i] /= norm;
  return vec;
}

const DOC1_EMBEDDING = generateTestEmbedding("Bluetooth wireless earbuds with noise cancellation");
const DOC2_EMBEDDING = generateTestEmbedding("Social media advertising campaign for product launch");

function makeDoc(overrides: Partial<KnowledgeDocument> & { id: string }): KnowledgeDocument {
  return {
    workspace_id: "ws-1",
    title: "Test",
    content: "Test content",
    source_type: "manual",
    category: "general",
    tags: [],
    embedding: generateTestEmbedding("test content"),
    metadata: {},
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// ============================================
// MOCK CLIENT (via Dependency Injection)
// ============================================
// Each test creates its own mock client with the data it needs.
// No vi.mock needed — the service accepts a client via constructor.

function createMockClient(docs: Record<string, unknown>[]): SupabaseClient {
  const fakeDocs = [...docs];
  let nextId = fakeDocs.length + 1;

  // Helper: build a thenable chain that resolves to { data, error }
  function makeChain(resultFn: () => { data: unknown; error: unknown }) {
    const chain: Record<string, unknown> = {};
    chain.select = vi.fn().mockReturnValue(chain);
    chain.insert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
      const id = `doc-${nextId++}`;
      fakeDocs.push({ ...row, id });
      // After insert, return a chain that resolves with the inserted row
      return makeChain(() => ({
        data: fakeDocs.find((d) => d.id === id) || { ...row, id },
        error: null,
      }));
    });
    chain.eq = vi.fn().mockReturnValue(chain);
    chain.order = vi.fn().mockReturnValue(chain);
    chain.limit = vi.fn().mockReturnValue(chain);
    chain.delete = vi.fn().mockReturnValue(chain);
    chain.single = vi.fn().mockImplementation(() =>
      makeChain(() => {
        const first = resultFn().data;
        const arr = Array.isArray(first) ? first : first ? [first] : [];
        return arr.length > 0
          ? { data: arr[0], error: null }
          : { data: null, error: { message: "not found" } };
      })
    );
    // Terminal: awaiting the chain resolves via resultFn
    chain.then = function (
      resolve: (v: { data: unknown; error: unknown }) => void,
      reject?: (e: unknown) => void
    ) {
      try {
        const result = resultFn();
        resolve(result);
      } catch (e) {
        if (reject) reject(e);
      }
    };
    return chain;
  }

  return {
    from: vi.fn().mockImplementation((_table: string) => {
      // Default chain: returns all docs, apply filtering in the chain
      let filters: Record<string, unknown> = {};
      let filteredDocs = [...fakeDocs];

      const chain: Record<string, unknown> = {};
      chain.select = vi.fn().mockReturnValue(chain);
      chain.insert = vi.fn().mockImplementation((row: Record<string, unknown>) => {
        const id = `doc-${nextId++}`;
        fakeDocs.push({ ...row, id });
        return makeChain(() => ({
          data: fakeDocs.find((d) => d.id === id) || { ...row, id },
          error: null,
        }));
      });
      chain.eq = vi.fn().mockImplementation((col: string, val: unknown) => {
        filters[col] = val;
        // Apply all accumulated filters to get the filtered set
        filteredDocs = fakeDocs.filter((doc) =>
          Object.entries(filters).every(([k, v]) => doc[k] === v)
        );
        return chain;
      });
      chain.order = vi.fn().mockReturnValue(chain);
      chain.limit = vi.fn().mockReturnValue(chain);
      chain.delete = vi.fn().mockReturnValue(chain);
      chain.single = vi.fn().mockImplementation(() =>
        makeChain(() => {
          const first = filteredDocs[0];
          return first
            ? { data: first, error: null }
            : { data: null, error: { message: "not found" } };
        })
      );
      // Terminal: plain function, NOT a vi.fn — await calls .then(resolve)
      chain.then = function (
        resolve: (v: { data: unknown; error: unknown }) => void,
        reject?: (e: unknown) => void
      ) {
        try {
          resolve({ data: filteredDocs, error: null });
        } catch (e) {
          if (reject) reject(e);
        }
      };
      return chain;
    }),
  };
}

// ============================================
// TESTS
// ============================================

describe("RAGService", () => {
  describe("storeDocument", () => {
    it("stores a document with embedding", async () => {
      const client = createMockClient([]);
      const service = new RAGService(client);

      const doc = await service.storeDocument({
        workspace_id: "ws-1",
        title: "Test Doc",
        content: "This is a test document about ecommerce products",
        category: "research",
        tags: ["test", "ecommerce"],
      });

      expect(doc.id).toBeDefined();
      expect(doc.title).toBe("Test Doc");
      expect(doc.embedding).toBeDefined();
      expect(doc.embedding!.length).toBe(384);
    });
  });

  describe("retrieve", () => {
    it("finds similar documents by content", async () => {
      const docs = [
        { id: "doc-1", workspace_id: "ws-1", title: "Wireless Earbuds", content: "Bluetooth wireless earbuds with noise cancellation", category: "products", embedding: DOC1_EMBEDDING, tags: [], metadata: {}, source_type: "manual", created_at: "", updated_at: "" },
        { id: "doc-2", workspace_id: "ws-1", title: "Marketing Strategy", content: "Social media advertising campaign for product launch", category: "marketing", embedding: DOC2_EMBEDDING, tags: [], metadata: {}, source_type: "manual", created_at: "", updated_at: "" },
      ];
      const client = createMockClient(docs);
      const service = new RAGService(client);

      const results = await service.retrieve("ws-1", "bluetooth headphones", { minScore: 0 });

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].document).toBeDefined();
      expect(results[0].score).toBeGreaterThan(0);
      expect(results[0].document.title).toBe("Wireless Earbuds");
    });

    it("returns empty for no documents", async () => {
      const client = createMockClient([]);
      const service = new RAGService(client);

      const results = await service.retrieve("ws-1", "test query");
      expect(results).toEqual([]);
    });

    it("respects minScore threshold", async () => {
      const docs = [
        { id: "doc-1", workspace_id: "ws-1", title: "Earbuds", content: "Bluetooth wireless earbuds", category: "general", embedding: DOC1_EMBEDDING, tags: [], metadata: {}, source_type: "manual", created_at: "", updated_at: "" },
      ];
      const client = createMockClient(docs);
      const service = new RAGService(client);

      const results = await service.retrieve("ws-1", "cooking recipes", { minScore: 0.99 });
      expect(results).toEqual([]);
    });
  });

  describe("buildContext", () => {
    it("builds context string from search results", () => {
      const service = new RAGService(createMockClient([]));
      const results = [
        { document: makeDoc({ id: "1", title: "Doc 1", content: "Content about products" }), score: 0.85 },
        { document: makeDoc({ id: "2", title: "Doc 2", content: "Content about marketing" }), score: 0.62 },
      ];

      const context = service.buildContext(results);

      expect(context).toContain("Relevant Knowledge");
      expect(context).toContain("Doc 1");
      expect(context).toContain("85% relevance");
      expect(context).toContain("Doc 2");
      expect(context).toContain("62% relevance");
    });

    it("returns empty for no results", () => {
      const service = new RAGService(createMockClient([]));
      expect(service.buildContext([])).toBe("");
    });
  });
});
