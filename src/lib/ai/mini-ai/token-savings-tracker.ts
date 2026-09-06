// Token Savings Tracker
// Tracks tokens saved by MiniIA optimizations.
// Displays savings in dashboard for visibility.

import { supabase } from "../../database/supabase";

export interface TokenSavingsRecord {
  id: string;
  workspace_id: string;
  timestamp: string;
  message_type: "greeting" | "simple_query" | "memory_lookup" | "product_search" | "complex_query";
  original_tokens: number;
  saved_tokens: number;
  savings_percent: number;
  source: "local" | "onnx" | "optimizer";
  agent_id?: string;
}

export interface TokenSavingsSummary {
  totalOriginal: number;
  totalSaved: number;
  savingsPercent: number;
  byType: Record<string, { count: number; saved: number }>;
  bySource: Record<string, { count: number; saved: number }>;
  dailySavings: Array<{ date: string; saved: number }>;
}

/**
 * Record token savings for a message.
 */
export async function recordTokenSavings(record: Omit<TokenSavingsRecord, "id" | "timestamp">): Promise<void> {
  try {
    const { error } = await supabase
      .from("token_savings")
      .insert({
        workspace_id: record.workspace_id,
        message_type: record.message_type,
        original_tokens: record.original_tokens,
        saved_tokens: record.saved_tokens,
        savings_percent: record.savings_percent,
        source: record.source,
        agent_id: record.agent_id,
      });

    if (error) {
      console.error("Failed to record token savings:", error);
    }
  } catch (error) {
    console.error("Token savings recording error:", error);
  }
}

/**
 * Get token savings summary for a workspace.
 */
export async function getTokenSavingsSummary(
  workspaceId: string,
  days: number = 30
): Promise<TokenSavingsSummary> {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  try {
    const { data: records, error } = await supabase
      .from("token_savings")
      .select("*")
      .eq("workspace_id", workspaceId)
      .gte("timestamp", startDate.toISOString())
      .order("timestamp", { ascending: false });

    if (error || !records || records.length === 0) {
      return getEmptySummary();
    }

    // Calculate totals
    const totalOriginal = records.reduce((sum: number, r: TokenSavingsRecord) => sum + r.original_tokens, 0);
    const totalSaved = records.reduce((sum: number, r: TokenSavingsRecord) => sum + r.saved_tokens, 0);
    const savingsPercent = totalOriginal > 0 ? (totalSaved / totalOriginal) * 100 : 0;

    // Group by type
    const byType: Record<string, { count: number; saved: number }> = {};
    for (const record of records) {
      if (!byType[record.message_type]) {
        byType[record.message_type] = { count: 0, saved: 0 };
      }
      byType[record.message_type].count++;
      byType[record.message_type].saved += record.saved_tokens;
    }

    // Group by source
    const bySource: Record<string, { count: number; saved: number }> = {};
    for (const record of records) {
      if (!bySource[record.source]) {
        bySource[record.source] = { count: 0, saved: 0 };
      }
      bySource[record.source].count++;
      bySource[record.source].saved += record.saved_tokens;
    }

    // Daily savings
    const dailySavings: Record<string, number> = {};
    for (const record of records) {
      const date = record.timestamp.split("T")[0];
      dailySavings[date] = (dailySavings[date] || 0) + record.saved_tokens;
    }

    const dailySavingsArray = Object.entries(dailySavings)
      .map(([date, saved]) => ({ date, saved }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalOriginal,
      totalSaved,
      savingsPercent: Math.round(savingsPercent * 100) / 100,
      byType,
      bySource,
      dailySavings: dailySavingsArray,
    };
  } catch (error) {
    console.error("Failed to get token savings summary:", error);
    return getEmptySummary();
  }
}

/**
 * Get empty summary (no data).
 */
function getEmptySummary(): TokenSavingsSummary {
  return {
    totalOriginal: 0,
    totalSaved: 0,
    savingsPercent: 0,
    byType: {},
    bySource: {},
    dailySavings: [],
  };
}

/**
 * Format token savings for display.
 */
export function formatTokenSavings(savings: number): string {
  if (savings >= 1000000) {
    return `${(savings / 1000000).toFixed(1)}M`;
  } else if (savings >= 1000) {
    return `${(savings / 1000).toFixed(1)}K`;
  }
  return String(savings);
}

/**
 * Calculate estimated cost savings (based on average LLM pricing).
 */
export function calculateCostSavings(tokensSaved: number): number {
  // Average cost per 1K tokens (GPT-4 level)
  const costPer1KTokens = 0.03;
  return (tokensSaved / 1000) * costPer1KTokens;
}

/**
 * Get savings insights.
 */
export function getSavingsInsights(summary: TokenSavingsSummary): string[] {
  const insights: string[] = [];

  if (summary.totalSaved > 0) {
    insights.push(
      `Ahorraste ${formatTokenSavings(summary.totalSaved)} tokens en los últimos 30 días`
    );
  }

  if (summary.savingsPercent > 50) {
    insights.push(
      `Excelente optimización: ${summary.savingsPercent}% de ahorro`
    );
  }

  const greetingSaved = summary.byType["greeting"]?.saved || 0;
  if (greetingSaved > 1000) {
    insights.push(
      `Los saludos ahorran ${formatTokenSavings(greetingSaved)} tokens`
    );
  }

  const localSaved = summary.bySource["local"]?.saved || 0;
  if (localSaved > 0) {
    insights.push(
      `${formatTokenSavings(localSaved)} tokens ahorrados con respuestas locales`
    );
  }

  return insights;
}
