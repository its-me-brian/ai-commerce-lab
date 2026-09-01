// Critic Mini-AI
// Evaluates quality of a response/output.
// Deterministic: rule-based scoring. LLM: semantic evaluation.

import { z } from "zod";
import type { MiniAIDefinition } from "../types";

// F10: Zod schemas for runtime validation
export const CriticInputSchema = z.object({
  response: z.string().min(1, "response is required"),
  criteria: z.array(z.string()).min(1, "at least one criterion required"),
  threshold: z.number().min(0).max(1).optional(),
});

export const CriticOutputSchema = z.object({
  overallScore: z.number().min(0).max(1),
  criteria: z.array(z.object({
    name: z.string(),
    score: z.number().min(0).max(1),
    feedback: z.string(),
  })),
  strengths: z.array(z.string()),
  weaknesses: z.array(z.string()),
  suggestions: z.array(z.string()),
  passThreshold: z.number().min(0).max(1),
  passed: z.boolean(),
});

export const criticDefinition: MiniAIDefinition = {
  id: "critic",
  name: "Critic",
  description: "Evaluates quality of a response or output against criteria",
  category: "evaluation",
  type: "critic",
  executionMode: "hybrid",
  instructions: `You are an evaluation specialist. Given a response and evaluation criteria:
1. Analyze the response against each criterion
2. Identify strengths and weaknesses
3. Assign scores (0.0-1.0) per criterion
4. Provide actionable feedback

Output format:
{
  "overallScore": 0.0-1.0,
  "criteria": [{ "name": "string", "score": 0.0-1.0, "feedback": "string" }],
  "strengths": ["string"],
  "weaknesses": ["string"],
  "suggestions": ["string"],
  "passThreshold": 0.0-1.0,
  "passed": boolean
}`,
  inputSchema: CriticInputSchema,
  outputSchema: CriticOutputSchema,
  modelRequirements: {
    complexity: "moderate",
    responseFormat: "json",
    minContextWindow: 4000,
  },
  defaultTemperature: 0.2,
  maxOutputTokens: 2048,
  enabled: true,
  version: "1.0.0",
  tags: ["evaluation", "critique", "quality"],
  timeoutMs: 20000,
};

/**
 * Deterministic implementation — rule-based quality scoring.
 */
export async function criticDeterministic(input: Record<string, unknown>) {
  const response = String(input.response || "");
  const criteria = Array.isArray(input.criteria) ? input.criteria : [];
  const threshold = Number(input.threshold) || 0.6;

  if (response.length === 0) {
    return {
      output: {
        overallScore: 0,
        criteria: [],
        strengths: [],
        weaknesses: ["Empty response"],
        suggestions: ["Provide a non-empty response"],
        passThreshold: threshold,
        passed: false,
      },
      confidence: 1,
      reasoning: "Cannot evaluate empty response",
    };
  }

  const criteriaResults = criteria.map((criterion: string) => {
    const criterionLower = criterion.toLowerCase();
    let score = 0.5; // Base score

    // Length check
    if (criterionLower.includes("length") || criterionLower.includes("detail")) {
      if (response.length > 200) score += 0.2;
      if (response.length > 500) score += 0.1;
      if (response.length < 50) score -= 0.3;
    }

    // Structure check
    if (criterionLower.includes("structure") || criterionLower.includes("format")) {
      if (response.includes("\n")) score += 0.1;
      if (response.match(/^\{[\s\S]*\}$/)) score += 0.2; // JSON
      if (response.match(/^#+\s/m)) score += 0.15; // Markdown headers
      if (response.match(/^- /m)) score += 0.1; // Bullet points
    }

    // Clarity check
    if (criterionLower.includes("clarity") || criterionLower.includes("clear")) {
      const avgWordLength = response.split(/\s+/).reduce((sum, w) => sum + w.length, 0) / response.split(/\s+/).length;
      if (avgWordLength < 8) score += 0.2; // Simpler words = clearer
      if (response.split(/[.!?]+/).length > 2) score += 0.1; // Multiple sentences
    }

    // Completeness check
    if (criterionLower.includes("complet") || criterionLower.includes("thorough")) {
      if (response.length > 300) score += 0.2;
      if (response.split(/[.!?]+/).length > 5) score += 0.15;
    }

    return {
      name: criterion,
      score: Math.max(0, Math.min(1, score)),
      feedback: score >= 0.6 ? "Meets criterion" : "Needs improvement",
    };
  });

  const overallScore = criteriaResults.length > 0
    ? criteriaResults.reduce((sum, c) => sum + c.score, 0) / criteriaResults.length
    : 0.5;

  const strengths = criteriaResults
    .filter((c) => c.score >= 0.7)
    .map((c) => `Strong on: ${c.name}`);

  const weaknesses = criteriaResults
    .filter((c) => c.score < 0.5)
    .map((c) => `Weak on: ${c.name}`);

  const suggestions = criteriaResults
    .filter((c) => c.score < 0.6)
    .map((c) => `Improve: ${c.name} — ${c.feedback}`);

  return {
    output: {
      overallScore,
      criteria: criteriaResults,
      strengths,
      weaknesses,
      suggestions,
      passThreshold: threshold,
      passed: overallScore >= threshold,
    },
    confidence: 0.6,
    reasoning: `Evaluated ${criteria.length} criteria, overall score: ${overallScore.toFixed(2)}`,
  };
}
