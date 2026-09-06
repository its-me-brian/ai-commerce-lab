// Web Search Tool
// Searches the internet using SerpAPI (Google Search).
// Free tier: 100 searches/month. Paid: $50/month for 5000 searches.

import type { Tool, ToolResult } from "./types";

export interface SearchResult {
  title: string;
  link: string;
  snippet: string;
  position: number;
  displayedLink?: string;
}

export interface SearchResponse {
  searchParameters: {
    q: string;
    gl: string;
    hl: string;
  };
  organicResults: SearchResult[];
  totalResults?: number;
}

export class WebSearchTool implements Tool {
  readonly id = "web_search";
  readonly name = "Web Search";
  readonly description =
    "Search the internet using Google via SerpAPI. Returns real-time search results with titles, URLs, and snippets. Requires SERPAPI_KEY environment variable.";
  readonly inputSchema = {
    type: "object",
    properties: {
      query: {
        type: "string",
        description: "Search query (e.g. 'best dropshipping products Spain 2026')",
      },
      country: {
        type: "string",
        description: "Country code for localized results (default: 'es' for Spain)",
        default: "es",
      },
      language: {
        type: "string",
        description: "Language code (default: 'es')",
        default: "es",
      },
      numResults: {
        type: "number",
        description: "Number of results to return (1-20, default: 10)",
        default: 10,
      },
    },
    required: ["query"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      results: { type: "array" },
      totalResults: { type: "number" },
      query: { type: "string" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const query = typeof input.query === "string" ? input.query : "";
    const country = typeof input.country === "string" ? input.country : "es";
    const language = typeof input.language === "string" ? input.language : "es";
    const numResults = typeof input.numResults === "number"
      ? Math.min(Math.max(input.numResults, 1), 20)
      : 10;

    if (!query || query.trim().length === 0) {
      return { success: false, output: null, error: "Query is required" };
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return {
        success: false,
        output: null,
        error: "SerpAPI not configured. Set SERPAPI_KEY in .env.local. Get free key at serpapi.com (100 searches/month free).",
      };
    }

    try {
      const params = new URLSearchParams({
        q: query,
        api_key: apiKey,
        gl: country,
        hl: language,
        num: String(numResults),
        engine: "google",
      });

      const response = await fetch(`https://serpapi.com/search.json?${params.toString()}`);

      if (response.status === 429) {
        return {
          success: false,
          output: null,
          error: "SerpAPI rate limit exceeded. Try again later or upgrade your plan.",
        };
      }

      if (!response.ok) {
        const body = await response.text();
        return {
          success: false,
          output: null,
          error: `SerpAPI error ${response.status}: ${body}`,
        };
      }

      const data: SearchResponse = await response.json();

      const results = (data.organicResults || []).map((r, i) => ({
        title: r.title,
        url: r.link,
        snippet: r.snippet,
        position: i + 1,
        displayedLink: r.displayedLink,
      }));

      return {
        success: true,
        output: {
          results,
          totalResults: results.length,
          query,
          country,
          language,
        },
      };
    } catch (error) {
      return {
        success: false,
        output: null,
        error: `Web search failed: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
