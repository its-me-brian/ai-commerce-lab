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

// --- FakeStoreAPI Source (free, no API key, ~20 real products) ---

class FakeStoreSource implements ProductSource {
  readonly id = "fakestore";
  readonly name = "FakeStore Products";

  async search(
    query: string,
    options?: { limit?: number; minPrice?: number; maxPrice?: number }
  ): Promise<RawProduct[]> {
    const limit = options?.limit || 10;

    // FakeStoreAPI doesn't support search — fetch all and filter client-side
    const response = await fetch("https://fakestoreapi.com/products");
    if (!response.ok) {
      throw new Error(`FakeStore API error: ${response.status}`);
    }

    const data = await response.json();
    const queryLower = query.toLowerCase();

    const products: RawProduct[] = (data || [])
      .map((p: Record<string, unknown>) => ({
        source: "fakestore",
        externalId: String(p.id),
        name: String(p.title),
        price: Number(p.price),
        currency: "USD",
        imageUrl: String(p.image || ""),
        url: `https://fakestoreapi.com/products/${p.id}`,
        category: String(p.category || ""),
        rating: typeof p.rating === "object" ? Number((p.rating as Record<string, unknown>).rate || 0) : 0,
        reviewCount: typeof p.rating === "object" ? Number((p.rating as Record<string, unknown>).count || 0) : 0,
      }))
      .filter((p: RawProduct) => {
        // Client-side search: match name or category
        const matchesQuery = !queryLower ||
          p.name.toLowerCase().includes(queryLower) ||
          (p.category && p.category.toLowerCase().includes(queryLower));
        if (!matchesQuery) return false;
        if (options?.minPrice && p.price < options.minPrice) return false;
        if (options?.maxPrice && p.price > options.maxPrice) return false;
        return true;
      })
      .slice(0, limit);

    return products;
  }
}

// --- eBay Browse API Source (free, 5000 req/day, requires OAuth registration) ---

class EbayBrowseSource implements ProductSource {
  readonly id = "ebay";
  readonly name = "eBay Products";

  private accessToken: string | null = null;
  private tokenExpiresAt = 0;

  async search(
    query: string,
    options?: { limit?: number; minPrice?: number; maxPrice?: number }
  ): Promise<RawProduct[]> {
    const clientId = process.env.EBAY_CLIENT_ID;
    const clientSecret = process.env.EBAY_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error(
        "eBay API not configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env.local. " +
        "Register free at developer.ebay.com"
      );
    }

    const limit = Math.min(options?.limit || 10, 50);

    // Get OAuth access token (client credentials grant)
    const token = await this.getAccessToken(clientId, clientSecret);

    // Build search URL with filters
    const params = new URLSearchParams({
      q: query,
      limit: String(limit),
      sort: "relevance",
    });

    // Add price filter
    const filters: string[] = [];
    if (options?.minPrice !== undefined || options?.maxPrice !== undefined) {
      const min = options?.minPrice ?? "*";
      const max = options?.maxPrice ?? "*";
      filters.push(`price:[${min}..${max}],priceCurrency:USD`);
    }
    if (filters.length > 0) {
      params.set("filter", filters.join(","));
    }

    const url = `https://api.ebay.com/buy/browse/v1/item_summary/search?${params.toString()}`;

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        "X-EBAY-C-MARKETPLACE-ID": "EBAY_US",
        "X-EBAY-C-ENDUSERCTX": "",
      },
    });

    if (response.status === 429) {
      throw new Error("eBay API rate limit exceeded. Try again in a few minutes.");
    }

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`eBay API error ${response.status}: ${body}`);
    }

    const data = await response.json();
    const items = data.itemSummaries || [];

    return items.map((item: Record<string, unknown>) => {
      const price = item.price as Record<string, unknown> | undefined;
      const seller = item.seller as Record<string, unknown> | undefined;
      const rating = item.rating as Record<string, unknown> | undefined;

      return {
        source: "ebay",
        externalId: String(item.itemId || ""),
        name: String(item.title || ""),
        price: Number(price?.value || 0),
        currency: String(price?.currency || "USD"),
        imageUrl: String((item.thumbnailImages as Array<Record<string, unknown>>)?.[0]?.imageUrl ||
          (item.image as Record<string, unknown>)?.imageUrl || ""),
        url: String(item.itemWebUrl || ""),
        category: String(item.categoryId || ""),
        rating: rating ? Number(rating.rating || 0) : undefined,
        reviewCount: rating ? Number(rating.count || 0) : undefined,
      };
    });
  }

  private async getAccessToken(clientId: string, clientSecret: string): Promise<string> {
    // Reuse token if still valid (with 5min buffer)
    if (this.accessToken && Date.now() < this.tokenExpiresAt - 300_000) {
      return this.accessToken;
    }

    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");

    const response = await fetch("https://api.ebay.com/identity/v1/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials&scope=https://api.ebay.com/oauth/api_scope",
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`eBay OAuth failed (${response.status}): ${body}`);
    }

    const data = await response.json();
    this.accessToken = data.access_token;
    this.tokenExpiresAt = Date.now() + (data.expires_in || 7200) * 1000;
    return this.accessToken!;
  }
}

// --- Tool Implementation ---

// Registry of search sources — add new sources here
const SEARCH_SOURCES: ProductSource[] = [
  new DummyJsonSource(),
  new FakeStoreSource(),
  new EbayBrowseSource(),
];

/**
 * Get available search sources (for Dashboard UI).
 * Only returns sources that are actually configured.
 */
export function getAvailableSources(): Array<{ id: string; name: string; configured: boolean }> {
  return SEARCH_SOURCES.map((s) => {
    let configured = true;
    if (s.id === "ebay") {
      configured = !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET);
    }
    return { id: s.id, name: s.name, configured };
  });
}

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
    // Runtime validation — no `as` casts
    const query = typeof input.query === "string" ? input.query : "";
    const sourceId = typeof input.source === "string" ? input.source : "dummyjson";
    const limit = typeof input.limit === "number" ? input.limit : 10;
    const minPrice = typeof input.minPrice === "number" ? input.minPrice : undefined;
    const maxPrice = typeof input.maxPrice === "number" ? input.maxPrice : undefined;

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
