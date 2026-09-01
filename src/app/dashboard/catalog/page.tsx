"use client";

import { useState, useEffect, useCallback } from "react";

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

const STATUS_COLORS: Record<string, string> = {
  discovered: "bg-blue-100 text-blue-800",
  evaluating: "bg-yellow-100 text-yellow-800",
  approved: "bg-green-100 text-green-800",
  listed: "bg-purple-100 text-purple-800",
  rejected: "bg-red-100 text-red-800",
  archived: "bg-gray-100 text-gray-800",
};

const DECISION_COLORS: Record<string, string> = {
  GO: "text-green-600 font-bold",
  CONDITIONAL_GO: "text-yellow-600 font-bold",
  NO_GO: "text-red-600 font-bold",
  NEEDS_MORE_DATA: "text-blue-600 font-bold",
};

export default function CatalogPage() {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [counts, setCounts] = useState<CatalogCounts>({
    discovered: 0, evaluating: 0, approved: 0, listed: 0, rejected: 0, archived: 0,
  });
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedProduct, setSelectedProduct] = useState<CatalogProduct | null>(null);

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set("status", statusFilter);
      if (searchQuery) params.set("search", searchQuery);

      const res = await fetch(`/api/catalog?${params.toString()}`);
      const data = await res.json();

      if (data.success) {
        setProducts(data.products);
        setCounts(data.counts);
      }
    } catch (err) {
      console.error("Failed to fetch catalog:", err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

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
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Product Catalog</h1>
          <p className="text-sm text-gray-500 mt-1">
            {totalProducts} products tracked across pipeline stages
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Search products..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Status Pipeline KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-3 mb-6">
        {(["discovered", "evaluating", "approved", "listed", "rejected", "archived"] as const).map(
          (status) => (
            <button
              key={status}
              onClick={() => setStatusFilter(statusFilter === status ? "" : status)}
              className={`p-3 rounded-lg border text-center transition-all ${
                statusFilter === status
                  ? "border-blue-500 bg-blue-50 ring-2 ring-blue-200"
                  : "border-gray-200 hover:border-gray-300"
              }`}
            >
              <div className="text-2xl font-bold">{counts[status]}</div>
              <div className="text-xs text-gray-500 capitalize">{status}</div>
            </button>
          )
        )}
      </div>

      {/* Content */}
      <div className="flex gap-6">
        {/* Product List */}
        <div className={`${selectedProduct ? "w-1/2" : "w-full"} transition-all`}>
          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : products.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">No products in catalog</p>
              <p className="text-sm">Run Product Hunter to discover products, then add them here.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {products.map((product) => (
                <div
                  key={product.id}
                  onClick={() => setSelectedProduct(product)}
                  className={`p-4 border rounded-lg cursor-pointer transition-all hover:shadow-md ${
                    selectedProduct?.id === product.id
                      ? "border-blue-500 ring-2 ring-blue-200"
                      : "border-gray-200"
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{product.name}</h3>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[product.status] || "bg-gray-100"}`}>
                          {product.status}
                        </span>
                      </div>
                      {product.category && (
                        <p className="text-xs text-gray-500 mt-1">{product.category}</p>
                      )}
                      <div className="flex items-center gap-4 mt-2 text-sm">
                        {product.supplier_price != null && (
                          <span className="text-gray-600">
                            Cost: {product.currency} {product.supplier_price.toFixed(2)}
                          </span>
                        )}
                        {product.selling_price != null && (
                          <span className="text-gray-600">
                            Price: {product.currency} {product.selling_price.toFixed(2)}
                          </span>
                        )}
                        {product.overall_score != null && (
                          <span className="font-medium">
                            Score: {product.overall_score}
                          </span>
                        )}
                        {product.decision && (
                          <span className={DECISION_COLORS[product.decision] || ""}>
                            {product.decision}
                          </span>
                        )}
                      </div>
                    </div>
                    {product.image_url && (
                      <img
                        src={product.image_url}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded ml-3"
                      />
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Detail Panel */}
        {selectedProduct && (
          <div className="w-1/2 border rounded-lg p-5 h-fit sticky top-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold">{selectedProduct.name}</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>

            {/* Status Actions */}
            <div className="flex gap-2 mb-4 flex-wrap">
              {(["discovered", "evaluating", "approved", "listed", "rejected"] as const).map(
                (status) => (
                  <button
                    key={status}
                    onClick={() => updateStatus(selectedProduct.id, status)}
                    disabled={selectedProduct.status === status}
                    className={`text-xs px-2 py-1 rounded border transition-colors ${
                      selectedProduct.status === status
                        ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed"
                        : "hover:bg-gray-50 border-gray-300"
                    }`}
                  >
                    → {status}
                  </button>
                )
              )}
            </div>

            {/* Details */}
            <div className="space-y-3 text-sm">
              {selectedProduct.description && (
                <div>
                  <label className="font-medium text-gray-700">Description</label>
                  <p className="text-gray-600 mt-1">{selectedProduct.description}</p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {selectedProduct.supplier_price != null && (
                  <div>
                    <label className="font-medium text-gray-700">Supplier Price</label>
                    <p>{selectedProduct.currency} {selectedProduct.supplier_price.toFixed(2)}</p>
                  </div>
                )}
                {selectedProduct.selling_price != null && (
                  <div>
                    <label className="font-medium text-gray-700">Selling Price</label>
                    <p>{selectedProduct.currency} {selectedProduct.selling_price.toFixed(2)}</p>
                  </div>
                )}
                {selectedProduct.overall_score != null && (
                  <div>
                    <label className="font-medium text-gray-700">Opportunity Score</label>
                    <p className="font-bold">{selectedProduct.overall_score}/100</p>
                  </div>
                )}
                {selectedProduct.risk_level && (
                  <div>
                    <label className="font-medium text-gray-700">Risk Level</label>
                    <p className="capitalize">{selectedProduct.risk_level}</p>
                  </div>
                )}
                {selectedProduct.source && (
                  <div>
                    <label className="font-medium text-gray-700">Source</label>
                    <p>{selectedProduct.source}</p>
                  </div>
                )}
                {selectedProduct.category && (
                  <div>
                    <label className="font-medium text-gray-700">Category</label>
                    <p>{selectedProduct.category}</p>
                  </div>
                )}
              </div>

              {selectedProduct.tags.length > 0 && (
                <div>
                  <label className="font-medium text-gray-700">Tags</label>
                  <div className="flex gap-1 mt-1 flex-wrap">
                    {selectedProduct.tags.map((tag) => (
                      <span key={tag} className="text-xs bg-gray-100 px-2 py-0.5 rounded">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {selectedProduct.notes && (
                <div>
                  <label className="font-medium text-gray-700">Notes</label>
                  <p className="text-gray-600 mt-1">{selectedProduct.notes}</p>
                </div>
              )}
            </div>

            {/* Delete */}
            <div className="mt-4 pt-4 border-t">
              <button
                onClick={() => deleteProduct(selectedProduct.id)}
                className="text-sm text-red-600 hover:text-red-800"
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
