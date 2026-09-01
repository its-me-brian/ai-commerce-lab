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

export function Button({
  children,
  variant = "primary",
  size = "md",
  disabled = false,
  onClick,
  className = "",
  type = "button",
}: {
  children: React.ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  disabled?: boolean;
  onClick?: () => void;
  className?: string;
  type?: "button" | "submit";
}) {
  return (
    <button
      type={type}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-[var(--r-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${SIZE_STYLES[size]} ${className}`}
      style={VARIANT_STYLES[variant]}
      onMouseEnter={(e) => {
        if (!disabled) {
          (e.target as HTMLElement).style.background = VARIANT_HOVER[variant];
        }
      }}
      onMouseLeave={(e) => {
        if (!disabled) {
          (e.target as HTMLElement).style.background = VARIANT_STYLES[variant].background as string;
        }
      }}
    >
      {children}
    </button>
  );
}
