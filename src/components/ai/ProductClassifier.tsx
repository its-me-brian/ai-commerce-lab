"use client";

import { useState, useCallback } from "react";
import { ErrorMessage } from "@/components/ui/ErrorMessage";
import { useBrowserML } from "@/lib/ai/mini-ai/browser-ml/use-browser-ml";

const CATEGORIES = [
  "Electronics",
  "Fashion & Clothing",
  "Home & Kitchen",
  "Sports & Outdoors",
  "Beauty & Health",
  "Toys & Games",
  "Automotive",
  "Pet Supplies",
  "Office Products",
  "Garden & Outdoor",
];

// Zero-shot classification model (runs entirely in browser)
const MODEL = "Xenova/bart-large-mnli";
const TASK = "zero-shot-classification";

export function ProductClassifier() {
  const { loadModel, inference, loading, ready, error, progress } = useBrowserML();
  const [input, setInput] = useState("");
  const [result, setResult] = useState<{ label: string; score: number }[] | null>(null);
  const [classifying, setClassifying] = useState(false);
  const [modelLoaded, setModelLoaded] = useState(false);

  const handleLoadModel = useCallback(async () => {
    await loadModel(MODEL, TASK);
    setModelLoaded(true);
  }, [loadModel]);

  const handleClassify = useCallback(async () => {
    if (!input.trim() || !ready) return;
    setClassifying(true);
    setResult(null);

    try {
      const res = await inference(input.trim(), {
        candidate_labels: CATEGORIES,
      });

      if (res?.output) {
        const output = res.output as { labels: string[]; scores: number[] };
        const ranked = output.labels.map((label, i) => ({
          label,
          score: Math.round(output.scores[i] * 100),
        }));
        setResult(ranked.slice(0, 5));
      }
    } catch {
      // Inference failed — model might not support zero-shot
      setResult(null);
    } finally {
      setClassifying(false);
    }
  }, [input, ready, inference]);

  return (
    <div style={{
      background: "var(--bg-card)", border: "1px solid var(--border)", borderRadius: "var(--r-lg)", padding: 20,
    }}>
      <h3 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 4 }}>
        Browser ML Classifier
      </h3>
      <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", marginBottom: 12 }}>
        Classifies products into categories using a model running entirely in your browser (no server needed)
      </p>

      {/* Load model button */}
      {!modelLoaded && (
        <button
          onClick={handleLoadModel}
          disabled={loading}
          style={{
            padding: "8px 16px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
            background: "var(--bg-sunken)", color: "var(--text-primary)", fontSize: "0.8125rem",
            cursor: loading ? "wait" : "pointer", marginBottom: 12,
          }}
        >
          {loading
            ? `Loading model... ${progress?.progress ? `${Math.round(progress.progress)}%` : ""}`
            : "Load Classification Model (~1.5MB)"}
        </button>
      )}

      {error && (
        <ErrorMessage message={error} className="mb-2" />
      )}

      {/* Input */}
      {modelLoaded && (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleClassify()}
              placeholder="Enter product name to classify..."
              aria-label="Product name to classify"
              style={{
                flex: 1, padding: "8px 12px", borderRadius: "var(--r-md)", border: "1px solid var(--border)",
                background: "var(--bg-sunken)", fontSize: "0.8125rem", color: "var(--text-primary)", outline: "none",
              }}
            />
            <button
              onClick={handleClassify}
              disabled={classifying || !input.trim()}
              style={{
                padding: "8px 16px", borderRadius: "var(--r-md)", border: "none",
                background: "var(--accent)", color: "#fff", fontSize: "0.8125rem", fontWeight: 600,
                cursor: classifying ? "wait" : "pointer",
                opacity: classifying || !input.trim() ? 0.5 : 1,
              }}
            >
              {classifying ? "Classifying..." : "Classify"}
            </button>
          </div>

          {/* Results */}
          {result && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {result.map((r) => (
                <div key={r.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 2 }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 500 }}>{r.label}</span>
                      <span style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)" }}>{r.score}%</span>
                    </div>
                    <div style={{ height: 4, borderRadius: 2, background: "var(--bg-sunken)" }}>
                      <div style={{
                        height: "100%", borderRadius: 2, width: `${r.score}%`,
                        background: r.score >= 70 ? "var(--success)" : r.score >= 40 ? "var(--warning)" : "var(--text-tertiary)",
                      }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {!modelLoaded && !loading && (
        <p style={{ fontSize: "0.6875rem", color: "var(--text-tertiary)", fontStyle: "italic" }}>
          Click &quot;Load Model&quot; to enable browser-side classification
        </p>
      )}
    </div>
  );
}
