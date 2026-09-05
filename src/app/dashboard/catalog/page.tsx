"use client";

import { useState, useEffect, useCallback } from "react";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorMessage } from "@/components/ui/ErrorMessage";

interface CatalogProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  supplier_price: number | null;
  selling_price: number | null;
  currency: string;
  image_url: string | null;
  source: string | null;
  overall_score: number | null;
  decision: string | null;
  risk_level: string | null;
  status: string;
  tags: string[];
  notes: string | null;
  created_at: string;
}

interface CatalogCounts {
  discovered: number;
  evaluating: number;
  approved: number;
  listed: number;
  rejected: number;
  archived: number;
}

const STATUS_BADGE_STYLES: Record<string, { bg: string; color: string }> = {
  discovered: { bg: "var(--info-bg)", color: "var(--info)" },
  evaluating: { bg: "var(--warning-bg)", color: "var(--warning)" },
  approved: { bg: "var(--success-bg)", color: "var(--success)" },
  listed: { bg: "var(--accent-light)", color: "var(--accent)" },
  rejected: { bg: "var(--error-bg)", color: "var(--error)" },
  archived: { bg: "var(--bg-sunken)", color: "var(--text-tertiary)" },
};

const DECISION_STYLES: Record<string, { color: string; fontWeight: string }> = {
  GO: { color: "var(--success)", fontWeight: "700" },
  CONDITIONAL_GO: { color: "var(--warning)", fontWeight: "700" },
  NO_GO: { color: "var(--error)", fontWeight: "700" },
  NEEDS_MORE_DATA: { color: "var(--info)", fontWeight: "700" },
};

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [counts, setCounts] = useState<CatalogCounts>({
    discovered: 0, evaluating: 0, approved: 0, listed: 0, rejected: 0, archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/catalog?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.products);
        setCounts(data.counts);
      } else {
        setError(data.error || "Failed to load catalog");
      }
    } catch  {
      setError("Failed to connect to the server. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);
      try {
        const res = await fetch(`/api/catalog?${params.toString()}`);
        const data = await res.json();
        if (cancelled) return;
        if (data.success) {
          setProducts(data.products);
          setCounts(data.counts);
        } else {
          setError(data.error || "Failed to load catalog");
        }
      } catch {
        if (!cancelled) setError("Failed to connect to the server. Please try again.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [statusFilter, searchQuery]);

  const updateStatus = async (id: string, status: string) => {
    try {
      await fetch(`/api/catalog/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      fetchProducts();
      if (selectedProduct?.id === id) {
        setSelectedProduct((prev) => (prev ? { ...prev, status } : null));
      }
    } catch (err) {
      console.error("Failed to update status:", err);
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Remove this product from catalog?")) return;
    try {
      await fetch(`/api/catalog/${id}`, { method: "DELETE" });
      setSelectedProduct(null);
      fetchProducts();
    } catch (err) {
      console.error("Failed to delete product:", err);
    }
  };

  const totalProducts = Object.values(counts).reduce((a, b) => a + b, 0);

  return (
    <div className="page-padding" style={{ maxWidth: 1200 }}>
      {/* Error display */}
      {error && (
        <ErrorMessage
          message={error}
          onRetry={fetchProducts}
          className="mb-6"
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1>Product Catalog</h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {totalProducts} products tracked across pipeline stages
          </p>
        </div>
        <input
          type="text"
          placeholder="Search products..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          aria-label="Search products"
          className="px-3 py-2 text-sm rounded-lg focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          style={{
            border: "1px solid var(--border)",
            background: "var(--bg-card)",
            color: "var(--text-primary)",
          }}
        />
      </div>

      {/* Status Pipeline KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {(["discovered", "evaluating", "approved", "listed", "rejected", "archived"] as const).map(
          (status) => {
            const isActive = statusFilter === status;
            return (
              <button
                key={status}
                onClick={() => setStatusFilter(isActive ? "" : status)}
                className="p-3 rounded-lg text-center transition-all"
                style={{
                  border: `1px solid ${isActive ? "var(--accent)" : "var(--border)"}`,
                  background: isActive ? "var(--accent-light)" : "var(--bg-card)",
                  boxShadow: isActive ? "0 0 0 2px var(--accent-muted)" : "none",
                }}
              >
                <div className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {counts[status]}
                </div>
                <div className="text-xs capitalize" style={{ color: "var(--text-tertiary)" }}>
                  {status}
                </div>
              </button>
            );
          }
        )}
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Product List */}
        <div className={selectedProduct ? "w-1/2" : "w-full"}>
          {loading ? (
            <div className="flex items-center justify-center py-8" role="status" aria-label="Loading">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="animate-spin" style={{ animation: "spin 1s linear infinite" }}>
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
          ) : products.length === 0 ? (
            <EmptyState
              icon="📦"
              title="No products in catalog"
              description="Products from Shopify or manual entry will appear here."
            />
          ) : (
            <div className="grid gap-3">
              {products.map((product) => {
                const isSelected = selectedProduct?.id === product.id;
                const statusStyle = STATUS_BADGE_STYLES[product.status] || STATUS_BADGE_STYLES.archived;
                return (
                  <div
                    key={product.id}
                    onClick={() => setSelectedProduct(product)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setSelectedProduct(product);
                      }
                    }}
                    role="button"
                    tabIndex={0}
                    className="p-4 rounded-lg cursor-pointer transition-all"
                    style={{
                      border: `1px solid ${isSelected ? "var(--accent)" : "var(--border)"}`,
                      background: "var(--bg-card)",
                      boxShadow: isSelected ? "0 0 0 2px var(--accent-muted)" : "var(--shadow-sm)",
                    }}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>
                            {product.name}
                          </h3>
                          <span
                            className="text-xs px-2 py-0.5 rounded-full"
                            style={{ background: statusStyle.bg, color: statusStyle.color }}
                          >
                            {product.status}
                          </span>
                        </div>
                        {product.category && (
                          <p className="text-xs mt-1" style={{ color: "var(--text-tertiary)" }}>
                            {product.category}
                          </p>
                        )}
                        <div className="flex items-center gap-4 mt-2 text-sm">
                          {product.supplier_price != null && (
                            <span style={{ color: "var(--text-secondary)" }}>
                              Cost: {product.currency} {product.supplier_price.toFixed(2)}
                            </span>
                          )}
                          {product.selling_price != null && (
                            <span style={{ color: "var(--text-secondary)" }}>
                              Price: {product.currency} {product.selling_price.toFixed(2)}
                            </span>
                          )}
                          {product.overall_score != null && (
                            <span style={{ color: "var(--text-primary)", fontWeight: 500 }}>
                              Score: {product.overall_score}
                            </span>
                          )}
                          {product.decision && DECISION_STYLES[product.decision] && (
                            <span style={DECISION_STYLES[product.decision]}>
                              {product.decision}
                            </span>
                          )}
                        </div>
                      </div>
                      {product.image_url && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="w-12 h-12 object-cover rounded ml-3"
                        />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedProduct && (
          <div
            className="w-1/2 rounded-lg p-5 h-fit sticky top-6"
            style={{ border: "1px solid var(--border)", background: "var(--bg-card)" }}
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelectedProduct(null);
            }}
            tabIndex={-1}
            aria-label="Product details"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>
                {selectedProduct.name}
              </h2>
              <button
                onClick={() => setSelectedProduct(null)}
                aria-label="Close product details"
                className="text-lg"
                style={{ color: "var(--text-tertiary)" }}
              >
                ✕
              </button>
            </div>

            {/* Status Actions */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["discovered", "evaluating", "approved", "listed", "rejected"] as const).map(
                (status) => {
                  const isCurrent = selectedProduct.status === status;
                  return (
                    <button
                      key={status}
                      onClick={() => updateStatus(selectedProduct.id, status)}
                      disabled={isCurrent}
                      className="text-xs px-2 py-1 rounded transition-colors"
                      style={{
                        border: `1px solid ${isCurrent ? "var(--border-subtle)" : "var(--border)"}`,
                        background: isCurrent ? "var(--bg-sunken)" : "transparent",
                        color: isCurrent ? "var(--text-tertiary)" : "var(--text-secondary)",
                        cursor: isCurrent ? "not-allowed" : "pointer",
                      }}
                    >
                      → {status}
                    </button>
                  );
                }
              )}
            </div>

            {/* Details */}
            <div className="space-y-3 text-sm">
              {selectedProduct.description && (
                <div>
                  <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Description</label>
                  <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                    {selectedProduct.description}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedProduct.supplier_price != null && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Supplier Price</label>
                    <p>{selectedProduct.currency} {selectedProduct.supplier_price.toFixed(2)}</p>
                  </div>
                )}
                {selectedProduct.selling_price != null && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Selling Price</label>
                    <p>{selectedProduct.currency} {selectedProduct.selling_price.toFixed(2)}</p>
                  </div>
                )}
                {selectedProduct.overall_score != null && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Opportunity Score</label>
                    <p className="font-bold">{selectedProduct.overall_score}/100</p>
                  </div>
                )}
                {selectedProduct.risk_level && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Risk Level</label>
                    <p className="capitalize">{selectedProduct.risk_level}</p>
                  </div>
                )}
                {selectedProduct.source && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Source</label>
                    <p>{selectedProduct.source}</p>
                  </div>
                )}
                {selectedProduct.category && (
                  <div>
                    <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Category</label>
                    <p>{selectedProduct.category}</p>
                  </div>
                )}
              </div>

              {selectedProduct.tags.length > 0 && (
                <div>
                  <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Tags</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {selectedProduct.tags.map((tag) => (
                      <span
                        key={tag}
                        className="text-xs px-2 py-0.5 rounded"
                        style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.notes && (
                <div>
                  <label style={{ color: "var(--text-primary)", fontWeight: 500 }}>Notes</label>
                  <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
                    {selectedProduct.notes}
                  </p>
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="mt-4 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
              <button
                onClick={() => deleteProduct(selectedProduct.id)}
                className="text-sm"
                style={{ color: "var(--error)" }}
              >
                Remove from catalog
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
