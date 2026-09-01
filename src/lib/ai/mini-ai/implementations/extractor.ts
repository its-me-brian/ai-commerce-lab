// Extractor Mini-AI
// Extracts structured data from unstructured input.
// Deterministic: regex + pattern matching. LLM: semantic extraction.

import type { MiniAIDefinition } from "../types";

export const extractorDefinition: MiniAIDefinition = {
  id: "extractor",
  name: "Extractor",
  description: "Extracts structured data from unstructured text (prices, names, features, etc.)",
  category: "extraction",
  type: "extractor",
  executionMode: "hybrid",
  instructions: `You are a data extraction specialist. Given unstructured text and a schema:
1. Identify all fields that match the schema
2. Extract values with high precision
3. Mark confidence for each extracted field
4. Return structured JSON matching the schema

Output format:
{
  "extracted": { ...schema fields },
  "confidence": 0.0-1.0,
  "missingFields": ["string"],
  "reasoning": "string"
}`,
  inputSchema: { text: "string", fields: "string[]" },
  outputSchema: {
    extracted: "object",
    confidence: "number",
    missingFields: "array",
  },
  modelRequirements: {
    complexity: "simple",
    responseFormat: "json",
    minContextWindow: 4000,
  },
  defaultTemperature: 0.1,
  maxOutputTokens: 2048,
  enabled: true,
  version: "1.0.0",
  tags: ["extraction", "parsing", "data"],
  timeoutMs: 15000,
};

/**
 * Deterministic implementation — regex-based extraction.
 */
export async function extractorDeterministic(input: Record<string, unknown>) {
  const text = String(input.text || "");
  const fields = Array.isArray(input.fields) ? input.fields : [];

  const extracted: Record<string, unknown> = {};
  const missingFields: string[] = [];

  // Price extraction patterns
  const pricePatterns = [
    /(\d+[\.,]\d{2})\s*(?:EUR|€|USD|\$)/gi,
    /(?:EUR|€|USD|\$)\s*(\d+[\.,]\d{2})/gi,
    /price[:\s]*(\d+[\.,]\d{2})/gi,
    /(\d+[\.,]\d{2})\s*(?:price|cost)/gi,
  ];

  // Percentage patterns
  const percentPatterns = [
    /(\d+[\.,]?\d*)\s*%/g,
    /margin[:\s]*(\d+[\.,]?\d*)/gi,
  ];

  // Number patterns
  const numberPatterns = [
    /(\d+(?:\.\d+)?)\s*(?:units?|pcs?|pieces?)/gi,
    /quantity[:\s]*(\d+)/gi,
  ];

  for (const field of fields) {
    const fieldLower = field.toLowerCase();
    let found = false;

    // Try price extraction
    if (fieldLower.includes("price") || fieldLower.includes("cost") || fieldLower.includes("margin")) {
      for (const pattern of pricePatterns) {
        const match = pattern.exec(text);
        if (match) {
          extracted[field] = parseFloat(match[1].replace(",", "."));
          found = true;
          break;
        }
      }
    }

    // Try percentage extraction
    if (!found && (fieldLower.includes("margin") || fieldLower.includes("percent") || fieldLower.includes("rate"))) {
      for (const pattern of percentPatterns) {
        const match = pattern.exec(text);
        if (match) {
          extracted[field] = parseFloat(match[1].replace(",", "."));
          found = true;
          break;
        }
      }
    }

    // Try general number extraction
    if (!found) {
      for (const pattern of numberPatterns) {
        const match = pattern.exec(text);
        if (match) {
          extracted[field] = parseFloat(match[1]);
          found = true;
          break;
        }
      }
    }

    // Try simple text match for name/description fields
    if (!found && (fieldLower.includes("name") || fieldLower.includes("title"))) {
      // Extract first capitalized phrase
      const nameMatch = text.match(/^([A-Z][^.!?]{5,50})/m);
      if (nameMatch) {
        extracted[field] = nameMatch[1].trim();
        found = true;
      }
    }

    if (!found) {
      missingFields.push(field);
    }
  }

  const extractedCount = Object.keys(extracted).length;
  const confidence = fields.length > 0 ? extractedCount / fields.length : 0;

  return {
    output: {
      extracted,
      confidence,
      missingFields,
      reasoning: `Extracted ${extractedCount}/${fields.length} fields using pattern matching`,
    },
    confidence,
    reasoning: `Regex-based extraction from ${text.length} characters`,
  };
}
