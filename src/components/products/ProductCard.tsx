"use client";

import React from "react";
import { Badge } from "../ui/Badge";

export interface ProductCardData {
  productId?: string;
  name: string;
  category?: string;
  price?: number;
  margin?: number;
  score?: number;
  source?: string;
  status: string;
  imageUrl?: string;
}

const STATUS_BADGES: Record<string, "success" | "warning" | "info" | "outline"> = {
  discovered: "info",
  evaluating: "warning",
  approved: "success",
  listed: "success",
  rejected: "outline",
};

export function ProductCard({ data }: { data: ProductCardData }) {
  return (
    <div
      className="rounded-xl p-4 border"
      style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: "var(--success-bg)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
              <line x1="3" y1="6" x2="21" y2="6" />
              <path d="M16 10a4 4 0 0 1-8 0" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: "var(--text-primary)" }}>
              Product
            </p>
            <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
              {data.source || "Unknown source"}
            </p>
          </div>
        </div>
        <Badge variant={STATUS_BADGES[data.status] || "outline"}>
          {data.status}
        </Badge>
      </div>

      {/* Product info */}
      <h3 className="text-sm font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
        {data.name}
      </h3>

      <div className="grid grid-cols-2 gap-2 text-xs">
        {data.category && (
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Category: </span>
            <span style={{ color: "var(--text-primary)" }}>{data.category}</span>
          </div>
        )}
        {data.price !== undefined && (
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Price: </span>
            <span style={{ color: "var(--text-primary)" }}>${data.price.toFixed(2)}</span>
          </div>
        )}
        {data.margin !== undefined && (
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Margin: </span>
            <span style={{ color: data.margin >= 30 ? "var(--success)" : "var(--warning)" }}>
              {data.margin.toFixed(1)}%
            </span>
          </div>
        )}
        {data.score !== undefined && (
          <div>
            <span style={{ color: "var(--text-tertiary)" }}>Score: </span>
            <span style={{ color: "var(--text-primary)" }}>{data.score}/100</span>
          </div>
        )}
      </div>
    </div>
  );
}
