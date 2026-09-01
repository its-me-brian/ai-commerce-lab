"use client";

import React from "react";

type SelectSize = "sm" | "md" | "lg";

const SIZE_CLASSES: Record<SelectSize, string> = {
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1.5 text-sm",
  lg: "px-4 py-2 text-sm",
};

export function Select({
  label,
  value,
  onChange,
  options,
  size = "md",
  disabled = false,
  required = false,
  placeholder,
  className = "",
  ...props
}: {
  label?: string;
  value?: string;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  options: { value: string; label: string }[];
  size?: SelectSize;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange" | "value" | "size">) {
  return (
    <div className={className} style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {label && (
        <label style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-secondary)" }}>
          {label}
          {required && <span style={{ color: "var(--error)", marginLeft: 2 }}>*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        required={required}
        className={`${SIZE_CLASSES[size]} rounded-[var(--r-sm)] transition-colors disabled:opacity-50 disabled:cursor-not-allowed`}
        style={{
          background: "var(--bg-card)",
          border: "1px solid var(--border)",
          color: "var(--text-primary)",
          outline: "none",
          appearance: "none",
          backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%236b7280' d='M3 4.5L6 8l3-3.5'/%3E%3C/svg%3E")`,
          backgroundRepeat: "no-repeat",
          backgroundPosition: "right 8px center",
          paddingRight: "28px",
        }}
        {...props}
      >
        {placeholder && (
          <option value="" disabled>
            {placeholder}
          </option>
        )}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}
