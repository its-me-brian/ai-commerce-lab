"use client";

import React from "react";

type BadgeVariant = "default" | "success" | "warning" | "error" | "info" | "outline";

const VARIANT_STYLES: Record<BadgeVariant, React.CSSProperties> = {
  default: { background: "var(--bg-sunken)", color: "var(--text-secondary)" },
  success: { background: "var(--success-bg)", color: "var(--success)" },
  warning: { background: "var(--warning-bg)", color: "var(--warning)" },
  error: { background: "var(--error-bg)", color: "var(--error)" },
  info: { background: "var(--info-bg)", color: "var(--info)" },
  outline: { border: "1px solid var(--border)", color: "var(--text-secondary)" },
};

export function Badge({
  children,
  variant = "default",
  className = "",
}: {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${className}`}
      style={VARIANT_STYLES[variant]}
    >
      {children}
    </span>
  );
}

export function EvidenceBadge({ level }: { level: "verified" | "estimated" | "unknown" }) {
  const variant = level === "verified" ? "success" : level === "estimated" ? "warning" : "outline";
  const label = level.charAt(0).toUpperCase() + level.slice(1);
  return <Badge variant={variant}>{label}</Badge>;
}
