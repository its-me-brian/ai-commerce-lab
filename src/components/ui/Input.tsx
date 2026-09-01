"use client";

import React from "react";

type InputSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<InputSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

export function Input({
  label,
  placeholder,
  value,
  onChange,
  type = "text",
  size = "md",
  disabled = false,
  required = false,
  error,
  className = "",
  ...props
}: {
  label?: string;
  placeholder?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  size?: InputSize;
  disabled?: boolean;
  required?: boolean;
  error?: string;
  className?: string;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "onChange" | "value" | "type" | "size">) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label && (
        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          {label}
          {required && <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`${SIZE_CLASSES[size]} rounded-[var(--r-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{
          background: "var(--bg-card)",
          border: error ? "1px solid var(--error)" : "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
        }}
        onFocus={(e) => {
          e.currentTarget.style.borderColor = "var(--accent)";
          e.currentTarget.style.boxShadow = "0 0 0 2px var(--accent-muted)";
        }}
        onBlur={(e) => {
          e.currentTarget.style.borderColor = error ? "var(--error)" : "var(--border)";
          e.currentTarget.style.boxShadow = "none";
        }}
        {...props}
      />
      {error && (
        <span style={{ fontSize: "0.7rem", color: "var(--error)" }}>{error}</span>
      )}
    </div>
  );
}
