// SEO Analysis Tool
// Analyzes product titles, descriptions, and keywords for SEO optimization.
// Deterministic scoring — no AI needed for basic SEO checks.
// FASE: Backend validation for content quality.

import type { Tool, ToolResult } from "./types";

export interface SeoAnalysis {
  score: number; // 0-100
  titleScore: number;
  descriptionScore: number;
  keywordScore: number;
  issues: string[];
  suggestions: string[];
  optimizedTitle: string;
  metaDescription: string;
  source_type: "deterministic";
}

export class AnalyzeSeoTool implements Tool {
  readonly id = "analyze_seo";
  readonly name = "Analyze SEO";
  readonly description = "Analyze product content for SEO quality. Returns score and improvement suggestions.";
  readonly inputSchema = {
    type: "object",
    properties: {
      title: { type: "string", description: "Product title to analyze" },
      description: { type: "string", description: "Product description to analyze" },
      keywords: { type: "array", description: "Target keywords" },
      category: { type: "string", description: "Product category" },
    },
    required: ["title"],
  };
  readonly outputSchema = {
    type: "object",
    properties: {
      score: { type: "number" },
      issues: { type: "array" },
      suggestions: { type: "array" },
    },
  };

  async execute(input: Record<string, unknown>): Promise<ToolResult> {
    const title = (input.title as string) || "";
    const description = (input.description as string) || "";
    const keywords = (input.keywords as string[]) || [];
    const category = (input.category as string) || "";

    const issues: string[] = [];
    const suggestions: string[] = [];

    // Title analysis
    let titleScore = 100;
    if (title.length < 30) {
      titleScore -= 20;
      issues.push("Title too short (< 30 chars)");
      suggestions.push("Expand title with key product features and benefits");
    }
    if (title.length > 60) {
      titleScore -= 15;
      issues.push("Title too long (> 60 chars) — may be truncated in search results");
      suggestions.push("Shorten title to under 60 characters");
    }
    if (!/[A-Z]/.test(title)) {
      titleScore -= 10;
      issues.push("Title lacks capitalization");
    }
    if (title === title.toLowerCase()) {
      titleScore -= 10;
      issues.push("Title is all lowercase");
    }

    // Description analysis
    let descriptionScore = 100;
    if (description.length === 0) {
      descriptionScore = 0;
      issues.push("No description provided");
      suggestions.push("Add a compelling product description (150-300 words)");
    } else {
      if (description.length < 100) {
        descriptionScore -= 30;
        issues.push("Description too short (< 100 chars)");
        suggestions.push("Expand description with benefits, features, and use cases");
      }
      if (description.length > 1000) {
        descriptionScore -= 10;
        issues.push("Description very long (> 1000 chars) — consider condensing");
      }
      if (!description.includes(".") && description.length > 20) {
        descriptionScore -= 10;
        issues.push("Description lacks proper sentence structure");
      }
    }

    // Keyword analysis
    let keywordScore = 100;
    if (keywords.length === 0) {
      keywordScore = 50;
      suggestions.push("Add 3-5 target keywords for better SEO");
    } else {
      if (keywords.length < 3) {
        keywordScore -= 20;
        suggestions.push("Add more keywords (aim for 3-5)");
      }
      if (keywords.length > 10) {
        keywordScore -= 10;
        suggestions.push("Too many keywords — focus on 3-5 primary keywords");
      }
    }

    // Check if title contains keywords
    if (keywords.length > 0) {
      const titleLower = title.toLowerCase();
      const keywordsInTitle = keywords.filter((k) => titleLower.includes(k.toLowerCase()));
      if (keywordsInTitle.length === 0) {
        titleScore -= 15;
        suggestions.push("Include primary keyword in the title");
      }
    }

    // Calculate overall score
    const score = Math.round((titleScore + descriptionScore + keywordScore) / 3);

    // Generate optimized title suggestion
    const optimizedTitle = title.length > 0
      ? title.slice(0, 55) + (title.length > 55 ? "..." : "")
      : "Product Title — [Add Brand] [Key Feature] [Benefit]";

    // Generate meta description
    const metaDescription = description.length > 0
      ? description.slice(0, 155) + (description.length > 155 ? "..." : "")
      : "Discover [Product Name] — [Key Benefit]. [Social Proof]. Free shipping to EU.";

    return {
      success: true,
      output: {
        score,
        titleScore: Math.max(0, titleScore),
        descriptionScore: Math.max(0, descriptionScore),
        keywordScore: Math.max(0, keywordScore),
        issues,
        suggestions,
        optimizedTitle,
        metaDescription,
        source_type: "deterministic",
      } as SeoAnalysis,
    };
  }
}
