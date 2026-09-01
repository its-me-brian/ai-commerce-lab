"use client";

import React, { useState } from "react";
import { Card, CardHeader, CardContent } from "../ui/Card";
import { Button } from "../ui/Button";
import { Badge } from "../ui/Badge";

interface Product {
  name: string;
  score?: number;
  estimatedMargin?: number;
  recommendedPrice?: number;
  category?: string;
  recommendation?: string;
}

export function ProductSearchPanel() {
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [response, setResponse] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSearch() {
    if (!query.trim()) return;
    setLoading(true);
    setError(null);
    setProducts([]);
    setResponse(null);

    try {
      const res = await fetch("/api/products/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: query.trim() }),
      });
      const data = await res.json();
      if (data.success) {
        setProducts(data.products || []);
        setResponse(data.response?.content || null);
      } else {
        setError(data.error || "Failed to search");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to search");
    } finally {
      setLoading(false);
    }
  }

  const suggestions = [
    "Wireless earbuds",
    "Phone cases",
    "Kitchen gadgets",
    "Pet accessories",
  ];

  return (
    <Card>
      <CardHeader
        title="Product Hunter"
        subtitle="Search for products to sell"
      />
      <CardContent>
        {/* Input */}
        <div className="flex gap-2 mb-4">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            placeholder="Search products..."
            className="flex-1 px-3 py-2 text-sm rounded-lg border focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
            style={{
              background: "var(--bg-sunken)",
              borderColor: "var(--border)",
              color: "var(--text-primary)",
            }}
          />
          <Button onClick={handleSearch} disabled={!query.trim() || loading}>
            {loading ? "Searching..." : "Search"}
          </Button>
        </div>

        {/* Suggestions */}
        {!products.length && !response && !error && (
          <div className="flex flex-wrap gap-1">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => setQuery(s)}
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

        {/* Products */}
        {products.length > 0 && (
          <div className="space-y-2">
            {products.map((product, i) => (
              <div
                key={i}
                className="p-3 rounded-lg"
                style={{ background: "var(--bg-sunken)" }}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                    {product.name}
                  </span>
                  {product.recommendation && (
                    <Badge
                      variant={
                        product.recommendation === "APPROVE"
                          ? "success"
                          : product.recommendation === "REJECT"
                            ? "error"
                            : "warning"
                      }
                    >
                      {product.recommendation}
                    </Badge>
                  )}
                </div>
                <div className="flex gap-3 text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                  {product.score !== undefined && <span>Score: {product.score}/100</span>}
                  {product.estimatedMargin !== undefined && (
                    <span>Margin: {product.estimatedMargin.toFixed(1)}%</span>
                  )}
                  {product.recommendedPrice !== undefined && (
                    <span>Price: ${product.recommendedPrice.toFixed(2)}</span>
                  )}
                  {product.category && <span>{product.category}</span>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Text response */}
        {response && products.length === 0 && (
          <div
            className="p-3 rounded-lg text-xs whitespace-pre-wrap"
            style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}
          >
            {response}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
