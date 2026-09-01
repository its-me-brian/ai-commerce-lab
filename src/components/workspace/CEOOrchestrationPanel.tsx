"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";

interface OrchestrationResult {
  conversationId: string;
  response: {
    content: string;
    provider?: string;
    model?: string;
  };
}

export function CEOOrchestrationPanel() {
  const [goal, setGoal] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<OrchestrationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleOrchestrate() {
    if (!goal.trim()) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/ceo/orchestrate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ goal: goal.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setResult(data);
      } else {
        setError(data.error || "Failed to orchestrate");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to orchestrate");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Find winning products to sell",
    "Research wireless earbuds market",
    "Create a marketing campaign for summer sale",
    "Analyze competitor pricing strategy",
  ];

  return (
    <Card>
      <CardHeader
        title="CEO Orchestration"
        subtitle="Send goals to the CEO agent"
      />
      <CardContent>
        {/* Input */}
        <div className="mb-4">
          <textarea
            value={goal}
            onChange={(e) => setGoal(e.target.value)}
            placeholder="Describe your goal..."
            rows={3}
            className="w-full px-3 py-2 text-sm rounded-lg border resize-none focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              background: "var(--bg-sunken)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <div className="flex justify-end mt-2">
            <Button
              onClick={handleOrchestrate}
              disabled={!goal.trim() || loading}
            >
              {loading ? "Orchestrating..." : "Send to CEO"}
            </Button>
          </div>
        </div>

        {/* Suggestions */}
        {!result && !error && (
          <div>
            <p className="text-xs mb-2" style={{ color: "var(--text-tertiary)" }}>
              Suggestions:
            </p>
            <div className="flex flex-wrap gap-1">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => setGoal(s)}
                  className="px-2 py-1 text-[11px] rounded-md transition-colors"
                  style={{
                    background: "var(--bg-sunken)",
                    color: "var(--text-secondary)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Error */}
        {error && (
          <div
            className="p-3 rounded-lg text-xs"
            style={{ background: "var(--error-bg)", color: "var(--error)" }}
          >
            {error}
          </div>
        )}

        {/* Result */}
        {result && (
          <div
            className="p-3 rounded-lg"
            style={{ background: "var(--bg-sunken)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <div
                className="w-6 h-6 rounded flex items-center justify-center text-[10px] font-bold"
                style={{ background: "var(--accent-light)", color: "var(--accent)" }}
              >
                C
              </div>
              <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                CEO Agent
              </span>
              {result.response.model && (
                <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                  · {result.response.model}
                </span>
              )}
            </div>
            <p className="text-xs whitespace-pre-wrap" style={{ color: "var(--text-secondary)" }}>
              {result.response.content}
            </p>
            {result.conversationId && (
              <p className="text-[10px] mt-2" style={{ color: "var(--text-tertiary)" }}>
                Conversation saved · ID: {result.conversationId.slice(0, 8)}…
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
