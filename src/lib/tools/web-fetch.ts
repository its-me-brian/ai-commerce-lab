// Web Fetch Tool
// Fetches and extracts content from web pages.
// Useful for reading product pages, reviews, pricing info, etc.

import type { Tool, ToolResult } from "./types";

export interface FetchResult {
  url: string;
  title: string;
  content: string;
  contentLength: number;
  fetchedAt: string;
}

export class WebFetchTool implements Tool {
  readonly id = "web_fetch";
  readonly name = "Web Fetch";
  readonly description =
    "Fetch and read content from a web page URL. Extracts text content, title, and metadata. Useful for reading product pages, reviews, pricing, and supplier information.";
  readonly inputSchema = {
    type: "object",
    properties: {
      url: {
        type: "string",
        description: "URL to fetch (e.g. 'https://aliexpress.com/item/123.html')",
      },
      maxLength: {
        type: "number",
        description: "Max characters to extract (default: 5000)",
        default: 5000,
      },
    },
    required: ["url"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      url: { type: "string" },
      title: { type: "string" },
      content: { type: "string" },
      contentLength: { type: "number" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const url = typeof input.url === "string" ? input.url : "";
    const maxLength = typeof input.maxLength === "number" ? input.maxLength : 5000;

    if (!url || url.trim().length === 0) {
      return { success: false, output: null, error: "URL is required" };
    }

    // Validate URL format
    try {
      new URL(url);
    } catch {
      return { success: false, output: null, error: `Invalid URL: ${url}` };
    }

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; AICommerceBot/1.0)",
          "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        },
        signal: AbortSignal.timeout(15000), // 15s timeout
      });

      if (!response.ok) {
        return {
          success: false,
          output: null,
          error: `HTTP ${response.status}: ${response.statusText}`,
        };
      }

      const html = await response.text();

      // Extract title
      const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
      const title = titleMatch ? titleMatch[1].trim() : "No title";

      // Extract text content (strip HTML tags)
      const content = this.extractText(html);
      const truncated = content.substring(0, maxLength);

      return {
        success: true,
        output: {
          url,
          title,
          content: truncated,
          contentLength: truncated.length,
          fetchedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes("timeout")) {
        return { success: false, output: null, error: "Request timed out after 15 seconds" };
      }
      return { success: false, output: null, error: `Fetch failed: ${msg}` };
    }
  }

  private extractText(html: string): string {
    // Remove scripts and styles
    let text = html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
      .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "");

    // Remove HTML tags
    text = text.replace(/<[^>]+>/g, " ");

    // Decode HTML entities
    text = text
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, " ");

    // Collapse whitespace
    text = text.replace(/\s+/g, " ").trim();

    return text;
  }
}
