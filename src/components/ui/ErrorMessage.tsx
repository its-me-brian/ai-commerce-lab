// ErrorMessage Component
// §5: User-facing error display for data fetching and operations

"use client";

import React from "react";

interface ErrorMessageProps {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}

export function ErrorMessage({
  title = "Something went wrong",
  message,
  onRetry,
  className = "",
}: ErrorMessageProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-8 px-4 ${className}`}
      style={{ background: "var(--bg-sunken)", borderRadius: "var(--r-lg)" }}
    >
      <div
        className="w-10 h-10 rounded-full flex items-center justify-center mb-3"
        style={{ background: "var(--error-light, #fef2f2)" }}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--error, #ef4444)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h3
        className="text-sm font-semibold mb-1"
        style={{ color: "var(--text-primary)" }}
      >
        {title}
      </h3>
      <p
        className="text-xs text-center max-w-[280px] mb-3"
        style={{ color: "var(--text-tertiary)" }}
      >
        {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="px-3 py-1.5 text-xs font-medium rounded-lg transition-colors"
          style={{
            background: "var(--accent)",
            color: "var(--text-inverse)",
          }}
        >
          Try again
        </button>
      )}
    </div>
  );
}
