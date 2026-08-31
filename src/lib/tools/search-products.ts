// Search Products Tool
// Discovers products from external sources.
// Uses DummyJSON as free default source (no API key needed).
// Architecture: add new sources by implementing ProductSearchSource interface.

import type { Tool, ToolResult } from "./types";

export interface ProductSource {
  id: string;
  name: string;
  search(
    query: string,
    options?: { limit?: number; minPrice?: number; maxPrice?: number }
  ): Promise<RawProduct[]>;
}

export interface RawProduct {
  source: string;
  externalId: string;
  name: string;
  price: number;
  currency: string;
  imageUrl?: string;
  url?: string;
  category?: string;
  rating?: number;
  reviewCount?: number;
}

// --- DummyJSON Source (free, no API key) ---

class DummyJsonSource implements ProductSource {
  readonly id = "dummyjson";
  readonly name = "DummyJSON Products";

  async search(
    query: string,
    options?: { limit?: number; minPrice?: number; maxPrice?: number }
  ): Promise<RawProduct[]> {
    const limit = options?.limit || 10;

    // DummyJSON supports search by keyword
    const url = `https://dummyjson.com/products/search?q=${encodeURIComponent(query)}&limit=${limit}`;

    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`DummyJSON API error: ${response.status}`);
    }

    const data = await response.json();
    const products: RawProduct[] = (data.products || [])
      .map((p: Record<string, unknown>) => ({
        source: "dummyjson",
        externalId: String(p.id),
        name: String(p.title),
        price: Number(p.price),
        currency: "USD",
        imageUrl: String(p.thumbnail || ""),
        url: `https://dummyjson.com/products/${p.id}`,
        category: String(p.category || ""),
        rating: Number(p.rating || 0),
        reviewCount: 0,
      }))
      .filter((p: RawProduct) => {
        if (options?.minPrice && p.price < options.minPrice) return false;
        if (options?.maxPrice && p.price > options.maxPrice) return false;
        return true;
      });

    return products;
  }
}

// --- Tool Implementation ---

// Registry of search sources — add new sources here
const SEARCH_SOURCES: ProductSource[] = [new DummyJsonSource()];

export class SearchProductsTool implements Tool {
  readonly id = "search_products";
  readonly name = "Search Products";
  readonly description =
    "Discovers products from external sources (DummyJSON, AliExpress, Amazon). Returns real product data with prices, images, and ratings.";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'wireless earbuds', 'phone case')",
      },
      source: {
        type: "string",
        description: "Source to search (default: dummyjson)",
        default: "dummyjson",
      },
      limit: {
        type: "number",
        description: "Max results (default: 10)",
        default: 10,
      },
      minPrice: {
        type: "number",
        description: "Minimum price filter",
      },
      maxPrice: {
        type: "number",
        description: "Maximum price filter",
      },
    },
    required: ["query"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      products: { type: "array" },
      totalCount: { type: "number" },
      source: { type: "string" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const query = input.query as string;
    const sourceId = (input.source as string) || "dummyjson";
    const limit = (input.limit as number) || 10;
    const minPrice = input.minPrice as number | undefined;
    const maxPrice = input.maxPrice as number | undefined;

    if (!query || query.trim().length === 0) {
      return { success: false, output: null, error: "Query is required" };
    }

    const source = SEARCH_SOURCES.find((s) => s.id === sourceId);
    if (!source) {
      return {
        success: false,
        output: null,
        error: `Source not found: ${sourceId}. Available: ${SEARCH_SOURCES.map((s) => s.id).join(", ")}`,
      };
    }

    try {
      const products = await source.search(query, {
        limit,
        minPrice,
        maxPrice,
      });

      return {
        success: true,
        output: {
          products,
          totalCount: products.length,
          source: source.id,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: `Search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
