"use client";

import React from "react";

export function MetricCard({
  label,
  value,
  change,
  icon,
  className = "",
}: {
  label: string;
  value: string | number;
  change?: { value: number; label?: string };
  icon?: string;
  className?: string;
}) {
  const isPositive = change && change.value > 0;
  const isNegative = change && change.value < 0;

  return (
    <div
      className={className}
      style={{
        padding: "16px",
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-md)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "0.75rem", color: "var(--text-secondary)", fontWeight: 500 }}>
          {label}
        </span>
        {icon && <span style={{ fontSize: "1rem" }}>{icon}</span>}
      </div>
      <div style={{ fontSize: "1.5rem", fontWeight: 700, color: "var(--text-primary)" }}>{value}</div>
      {change && (
        <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: "0.7rem" }}>
          <span
            style={{
              color: isPositive ? "var(--success)" : isNegative ? "var(--error)" : "var(--text-tertiary)",
              fontWeight: 600,
            }}
          >
            {isPositive ? "↑" : isNegative ? "↓" : "→"} {Math.abs(change.value)}%
          </span>
          {change.label && (
            <span style={{ color: "var(--text-tertiary)" }}>{change.label}</span>
          )}
        </div>
      )}
    </div>
  );
}
