// Search Products Tool
// Discovers products from external sources.
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
  new EbayBrowseSource(),
];

/**
 * Get available search sources (for Dashboard UI).
 * Only returns sources that are actually configured.
 */
export function getAvailableSources(): Array<{ id: string; name: string; configured: boolean }> {
  return SEARCH_SOURCES.map((s) => {
    const configured = s.id === "ebay"
      ? !!(process.env.EBAY_CLIENT_ID && process.env.EBAY_CLIENT_SECRET)
      : true;
    return { id: s.id, name: s.name, configured };
  });
}

/**
 * Get the best available source for a query.
 * Returns the first configured source, or throws if none configured.
 */
export function getDefaultSource(): string {
  const sources = getAvailableSources();
  const configured = sources.find((s) => s.configured);
  if (!configured) {
    throw new Error("No product search source configured. Set EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env.local.");
  }
  return configured.id;
}

export class SearchProductsTool implements Tool {
  readonly id = "search_products";
  readonly name = "Search Products";
  readonly description =
    "Discovers products from external sources. Requires eBay API configuration (EBAY_CLIENT_ID, EBAY_CLIENT_SECRET).";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'wireless earbuds', 'phone case')",
      },
      source: {
        type: "string",
        description: "Source to search (default: ebay)",
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
    const sourceId = typeof input.source === "string" ? input.source : getDefaultSource();
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
        error: `Source not found: ${sourceId}. Available: ${SEARCH_SOURCES.map((s) => s.id).join(", ")}. Configure EBAY_CLIENT_ID and EBAY_CLIENT_SECRET in .env.local.`,
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
