// Classifier Mini-AI
// Categorizes input into predefined categories.
// Deterministic: rule-based matching. LLM: semantic classification.

import { z } from "zod";
import type { MiniAIDefinition } from "../types";

// F10: Zod schemas for runtime validation
export const ClassifierInputSchema = z.object({
  text: z.string().min(1, "text is required"),
  categories: z.array(z.string()).min(1, "at least one category required"),
  context: z.string().optional(),
});

export const ClassifierOutputSchema = z.object({
  bestCategory: z.string(),
  confidence: z.number().min(0).max(1),
  allCategories: z.array(z.object({
    category: z.string(),
    score: z.number().min(0).max(1),
  })),
  reasoning: z.string().optional(),
});

export const classifierDefinition: MiniAIDefinition = {
  id: "classifier",
  name: "Classifier",
  description: "Categorizes input into predefined categories with confidence scores",
  category: "validation",
  type: "classifier",
  executionMode: "hybrid",
  instructions: `You are a classification specialist. Given input text and a list of categories:
1. Analyze the input content
2. Match it against the provided categories
3. Assign confidence scores (0.0-1.0) to each category
4. Return the best match and all scored categories

Output format:
{
  "bestCategory": "string",
  "confidence": 0.0-1.0,
  "allCategories": [{ "category": "string", "score": 0.0-1.0 }],
  "reasoning": "string"
}`,
  inputSchema: ClassifierInputSchema,
  outputSchema: ClassifierOutputSchema,
  modelRequirements: {
    complexity: "simple",
    responseFormat: "json",
    minContextWindow: 4000,
  },
  defaultTemperature: 0.1,
  maxOutputTokens: 1024,
  enabled: true,
  version: "1.0.0",
  tags: ["classification", "categorization", "validation"],
  timeoutMs: 15000,
};

/**
 * Deterministic implementation — rule-based keyword matching.
 */
export async function classifierDeterministic(input: Record<string, unknown>) {
  const text = String(input.text || "").toLowerCase();
  const categories = Array.isArray(input.categories) ? input.categories : [];

  if (categories.length === 0) {
    return {
      output: {
        bestCategory: "unknown",
        confidence: 0,
        allCategories: [],
        reasoning: "No categories provided",
      },
      confidence: 0,
      reasoning: "No categories to classify against",
    };
  }

  // Simple keyword-based scoring
  const scores = categories.map((cat: string) => {
    const catLower = cat.toLowerCase();
    const catWords = catLower.split(/[\s-_]+/);
    let score = 0;

    for (const word of catWords) {
      if (word.length > 2 && text.includes(word)) {
        score += 0.3;
      }
    }

    // Exact match bonus
    if (text.includes(catLower)) {
      score += 0.5;
    }

    return {
      category: cat,
      score: Math.min(score, 1.0),
    };
  });

  // Sort by score descending
  scores.sort((a, b) => b.score - a.score);

  const best = scores[0];

  return {
    output: {
      bestCategory: best.category,
      confidence: best.score,
      allCategories: scores,
      reasoning: `Rule-based matching: best match is "${best.category}" with score ${best.score.toFixed(2)}`,
    },
    confidence: best.score,
    reasoning: `Classified into ${categories.length} categories using keyword matching`,
  };
}
