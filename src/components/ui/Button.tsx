"use client";

import React from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

const VARIANT_STYLES: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: "var(--accent)", color: "var(--text-inverse)" },
  secondary: { background: "var(--bg-sunken)", color: "var(--text-primary)", border: "1px solid var(--border)" },
  ghost: { color: "var(--text-secondary)" },
  danger: { background: "var(--error)", color: "var(--text-inverse)" },
};

const VARIANT_HOVER: Record<ButtonVariant, string> = {
  primary: "var(--accent-hover)",
  secondary: "var(--bg-hover)",
  ghost: "var(--bg-hover)",
  danger: "var(--error)",
};

const SIZE_STYLES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="animate-spin"
      style={{ animation: "spin 1s linear infinite" }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  loading = false,
  onClick,
  className = "",
  type = "button",
  "aria-label": ariaLabel,
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
  "aria-label"?: string;
}) {
  const isDisabled = disabled || loading;
  return (
    <button
      type={type}
      disabled={isDisabled}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-busy={loading || undefined}
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-[var(--r-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_STYLES[size]} ${className}`}
      style={VARIANT_STYLES[variant]}
      onMouseEnter={(e) => {
        if (!isDisabled) {
          (e.target as HTMLElement).style.background = VARIANT_HOVER[variant];
        }
      }}
      onMouseLeave={(e) => {
        if (!isDisabled) {
          (e.target as HTMLElement).style.background = VARIANT_STYLES[variant].background as string;
        }
      }}
    >
      {loading && <Spinner size={size === "sm" ? 12 : 14} />}
      {children}
    </button>
  );
}
