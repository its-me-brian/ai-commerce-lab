// Researcher Mini-AI
// Investigates a topic and returns structured findings.
// Can work deterministically (simple keyword extraction) or via LLM (deep research).

import { z } from "zod";
import type { MiniAIDefinition } from "../types";

// F10: Zod schemas for runtime validation
export const ResearcherInputSchema = z.object({
  topic: z.string().min(1, "topic is required"),
  context: z.string().optional(),
});

export const ResearcherOutputSchema = z.object({
  topic: z.string(),
  findings: z.array(z.object({
    fact: z.string(),
    confidence: z.number().min(0).max(1),
    source: z.string(),
  })),
  sources: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  summary: z.string(),
});

export const researcherDefinition: MiniAIDefinition = {
  id: "researcher",
  name: "Researcher",
  description: "Investigates a topic and returns structured findings with sources and confidence",
  category: "research",
  type: "researcher",
  executionMode: "hybrid",
  instructions: `You are a research specialist. Given a topic or query:
1. Analyze the input thoroughly
2. Identify key facts, trends, and insights
3. Assess confidence level for each finding
4. Structure findings as JSON with: topic, findings[], sources[], confidence, summary

Output format:
{
  "topic": "string",
  "findings": [{ "fact": "string", "confidence": 0.0-1.0, "source": "string" }],
  "sources": ["string"],
  "confidence": 0.0-1.0,
  "summary": "string"
}`,
  inputSchema: ResearcherInputSchema,
  outputSchema: ResearcherOutputSchema,
  modelRequirements: {
    complexity: "moderate",
    responseFormat: "json",
    minContextWindow: 8000,
  },
  defaultTemperature: 0.3,
  maxOutputTokens: 2048,
  enabled: true,
  version: "1.0.0",
  tags: ["research", "analysis", "investigation"],
  timeoutMs: 30000,
};

/**
 * Deterministic implementation — extracts basic info without LLM.
 */
export async function researcherDeterministic(input: Record<string, unknown>) {
  const topic = String(input.topic || input.query || "unknown");
  const context = String(input.context || "");

  // Simple keyword extraction
  const words = topic.toLowerCase().split(/\s+/);
  const stopWords = new Set(["the", "a", "an", "is", "are", "was", "were", "in", "on", "at", "to", "for", "of", "with", "by", "and", "or", "not", "this", "that", "it"]);
  const keywords = words.filter((w) => w.length > 2 && !stopWords.has(w));

  const findings = keywords.map((kw) => ({
    fact: `Topic contains keyword: "${kw}"`,
    confidence: 0.5,
    source: "keyword-extraction",
  }));

  return {
    output: {
      topic,
      findings,
      sources: ["keyword-extraction"],
      confidence: keywords.length > 0 ? 0.4 : 0.1,
      summary: `Extracted ${keywords.length} keywords from topic: "${topic}"`,
    },
    confidence: keywords.length > 0 ? 0.4 : 0.1,
    reasoning: `Deterministic keyword extraction found ${keywords.length} relevant terms`,
  };
}
