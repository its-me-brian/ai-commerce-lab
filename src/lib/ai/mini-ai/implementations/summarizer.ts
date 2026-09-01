// Summarizer Mini-AI
// Reduces large input to concise summary.
// Deterministic: sentence scoring. LLM: semantic summarization.

import { z } from "zod";
import type { MiniAIDefinition } from "../types";

// F10: Zod schemas for runtime validation
export const SummarizerInputSchema = z.object({
  text: z.string().min(1, "text is required"),
  maxLength: z.number().positive().optional(),
  focus: z.string().optional(),
});

export const SummarizerOutputSchema = z.object({
  summary: z.string(),
  keyPoints: z.array(z.string()),
  compressionRatio: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1).optional(),
});

export const summarizerDefinition: MiniAIDefinition = {
  id: "summarizer",
  name: "Summarizer",
  description: "Reduces large text to concise summary preserving key information",
  category: "transformation",
  type: "summarizer",
  executionMode: "hybrid",
  instructions: `You are a summarization specialist. Given a long text:
1. Identify the most important sentences and concepts
2. Create a concise summary that preserves key information
3. Maintain the original meaning and tone
4. Output structured summary

Output format:
{
  "summary": "string",
  "keyPoints": ["string"],
  "compressionRatio": 0.0-1.0,
  "confidence": 0.0-1.0
}`,
  inputSchema: SummarizerInputSchema,
  outputSchema: SummarizerOutputSchema,
  modelRequirements: {
    complexity: "simple",
    responseFormat: "json",
    minContextWindow: 8000,
  },
  defaultTemperature: 0.3,
  maxOutputTokens: 1024,
  enabled: true,
  version: "1.0.0",
  tags: ["summarization", "compression", "transformation"],
  timeoutMs: 20000,
};

/**
 * Deterministic implementation — extractive summarization using sentence scoring.
 */
export async function summarizerDeterministic(input: Record<string, unknown>) {
  const text = String(input.text || "");
  const maxLength = Number(input.maxLength) || 3;

  if (text.length === 0) {
    return {
      output: {
        summary: "",
        keyPoints: [],
        compressionRatio: 0,
        confidence: 0,
      },
      confidence: 0,
      reasoning: "Empty input text",
    };
  }

  // Split into sentences
  const sentences = text
    .split(/[.!?]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 10);

  if (sentences.length === 0) {
    return {
      output: {
        summary: text.slice(0, 200),
        keyPoints: [text.slice(0, 100)],
        compressionRatio: text.length > 200 ? 200 / text.length : 1,
        confidence: 0.2,
      },
      confidence: 0.2,
      reasoning: "No valid sentences found, returned truncated text",
    };
  }

  // Score sentences by position + keyword density
  const scored = sentences.map((sentence, index) => {
    let score = 0;

    // Position bonus (first and last sentences are important)
    if (index === 0) score += 0.4;
    else if (index === sentences.length - 1) score += 0.3;
    else if (index < sentences.length * 0.3) score += 0.2;

    // Length bonus (medium-length sentences are best)
    const words = sentence.split(/\s+/).length;
    if (words >= 8 && words <= 30) score += 0.2;

    // Keyword indicators
    const lower = sentence.toLowerCase();
    if (lower.includes("important") || lower.includes("key") || lower.includes("main")) score += 0.2;
    if (lower.includes("therefore") || lower.includes("conclusion") || lower.includes("result")) score += 0.15;
    if (lower.includes("however") || lower.includes("but") || lower.includes("although")) score += 0.1;

    return { sentence, score, index };
  });

  // Sort by score and take top N
  scored.sort((a, b) => b.score - a.score);
  const topSentences = scored.slice(0, maxLength);

  // Reorder by original position
  topSentences.sort((a, b) => a.index - b.index);

  const summary = topSentences.map((s) => s.sentence).join(". ");
  const keyPoints = topSentences.map((s) => s.sentence.slice(0, 100));

  return {
    output: {
      summary,
      keyPoints,
      compressionRatio: text.length > 0 ? summary.length / text.length : 0,
      confidence: Math.min(0.3 + sentences.length * 0.05, 0.8),
    },
    confidence: Math.min(0.3 + sentences.length * 0.05, 0.8),
    reasoning: `Extractive summarization: selected ${topSentences.length}/${sentences.length} sentences by score`,
  };
}
