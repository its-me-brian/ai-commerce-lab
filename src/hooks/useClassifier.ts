// useClassifier — Client-side classification using Browser ML ONNX models.
//
// Uses Xenova/distilbert-base-uncased-finetuned-sst-2-english for sentiment
// and falls back to keyword matching for custom categories.
//
// Usage:
//   const { classify, loading, error } = useClassifier();
//   const result = await classify("This product is great!", ["positive", "negative"]);

"use client";

import { useState, useCallback, useRef } from "react";
import { getBrowserMLProvider } from "@/lib/ai/mini-ai/browser-ml/provider";

const CLASSIFICATION_MODEL = "Xenova/distilbert-base-uncased-finetuned-sst-2-english";
const CLASSIFICATION_TASK = "text-classification";

export interface ClassificationResult {
  bestCategory: string;
  confidence: number;
  allCategories: Array<{ category: string; score: number }>;
  reasoning: string;
}

export interface UseClassifierReturn {
  /** Classify text into categories using ONNX model */
  classify: (text: string, categories: string[]) => Promise<ClassificationResult>;
  /** Whether an operation is in progress */
  loading: boolean;
  /** Current error message */
  error: string | null;
  /** Whether the classification model is loaded */
  modelReady: boolean;
  /** Load the classification model (auto-called on first use) */
  ensureModel: () => Promise<void>;
}

/**
 * Map ONNX sentiment labels to custom categories.
 * The model outputs POSITIVE/NEGATIVE with scores.
 */
function mapSentimentToCategories(
  modelOutput: unknown,
  categories: string[]
): Array<{ category: string; score: number }> {
  const results: Array<{ category: string; score: number }> = [];

  // Parse model output
  let positiveScore = 0.5;
  let negativeScore = 0.5;

  if (Array.isArray(modelOutput)) {
    // Format: [{ label: "POSITIVE", score: 0.9 }, { label: "NEGATIVE", score: 0.1 }]
    for (const item of modelOutput) {
      if (typeof item === "object" && item !== null) {
        const obj = item as Record<string, unknown>;
        if (typeof obj.label === "string" && typeof obj.score === "number") {
          if (obj.label.toUpperCase() === "POSITIVE") {
            positiveScore = obj.score;
          } else if (obj.label.toUpperCase() === "NEGATIVE") {
            negativeScore = obj.score;
          }
        }
      }
    }
  } else if (typeof modelOutput === "object" && modelOutput !== null) {
    const obj = modelOutput as Record<string, unknown>;
    // Format: { label: "POSITIVE", score: 0.9 }
    if (typeof obj.label === "string" && typeof obj.score === "number") {
      if (obj.label.toUpperCase() === "POSITIVE") {
        positiveScore = obj.score;
        negativeScore = 1 - obj.score;
      } else {
        negativeScore = obj.score;
        positiveScore = 1 - obj.score;
      }
    }
  }

  // Map sentiment to custom categories using keyword matching
  const positiveKeywords = ["good", "great", "excellent", "positive", "like", "love", "best", "amazing", "awesome", "perfect"];
  const negativeKeywords = ["bad", "poor", "terrible", "negative", "dislike", "hate", "worst", "awful", "horrible", "broken"];

  for (const cat of categories) {
    const catLower = cat.toLowerCase();
    let score = 0;

    // Check if category matches positive/negative keywords
    const isPositive = positiveKeywords.some(kw => catLower.includes(kw));
    const isNegative = negativeKeywords.some(kw => catLower.includes(kw));

    if (isPositive) {
      score = positiveScore;
    } else if (isNegative) {
      score = negativeScore;
    } else {
      // For neutral categories, use average with slight positive bias
      score = (positiveScore + 0.5) / 2;
    }

    // Exact match bonus
    if (catLower === "positive" || catLower === "negative") {
      score = catLower === "positive" ? positiveScore : negativeScore;
    }

    results.push({ category: cat, score: Math.min(Math.max(score, 0), 1) });
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results;
}

/**
 * Keyword-based fallback when ONNX model is unavailable.
 */
function keywordClassify(text: string, categories: string[]): Array<{ category: string; score: number }> {
  const textLower = text.toLowerCase();

  const results = categories.map(cat => {
    const catLower = cat.toLowerCase();
    const catWords = catLower.split(/[\s-_]+/);
    let score = 0;

    for (const word of catWords) {
      if (word.length > 2 && textLower.includes(word)) {
        score += 0.3;
      }
    }

    if (textLower.includes(catLower)) {
      score += 0.5;
    }

    return { category: cat, score: Math.min(score, 1) };
  });

  results.sort((a, b) => b.score - a.score);
  return results;
}

export function useClassifier(): UseClassifierReturn {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modelReady, setModelReady] = useState(false);
  const providerRef = useRef(getBrowserMLProvider());

  const ensureModel = useCallback(async () => {
    if (modelReady) return;

    try {
      await providerRef.current.loadModel(CLASSIFICATION_MODEL, CLASSIFICATION_TASK);
      setModelReady(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Failed to load classification model: ${msg}`);
      // Don't throw — fall back to keyword matching
    }
  }, [modelReady]);

  const classify = useCallback(async (
    text: string,
    categories: string[]
  ): Promise<ClassificationResult> => {
    setLoading(true);
    setError(null);

    try {
      // Try ONNX classification first
      let scored: Array<{ category: string; score: number }>;

      try {
        await ensureModel();
        const result = await providerRef.current.inference(text);

        if (result?.output) {
          scored = mapSentimentToCategories(result.output, categories);
        } else {
          // Fallback to keyword matching
          scored = keywordClassify(text, categories);
        }
      } catch {
        // Model unavailable — use keyword fallback
        scored = keywordClassify(text, categories);
      }

      const best = scored[0];

      return {
        bestCategory: best.category,
        confidence: best.score,
        allCategories: scored,
        reasoning: modelReady
          ? `ONNX classification: "${best.category}" with confidence ${best.score.toFixed(2)}`
          : `Keyword fallback: "${best.category}" with score ${best.score.toFixed(2)}`,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);

      // Last resort: keyword fallback
      const scored = keywordClassify(text, categories);
      const best = scored[0];

      return {
        bestCategory: best.category,
        confidence: best.score,
        allCategories: scored,
        reasoning: `Error fallback: "${best.category}" with score ${best.score.toFixed(2)}`,
      };
    } finally {
      setLoading(false);
    }
  }, [modelReady, ensureModel]);

  return {
    classify,
    loading,
    error,
    modelReady,
    ensureModel,
  };
}
