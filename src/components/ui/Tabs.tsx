"use client";

import React, { useState } from "react";

export function Tabs({
  tabs,
  defaultTab,
  onChange,
  className = "",
}: {
  tabs: { key: string; label: string; count?: number }[];
  defaultTab?: string;
  onChange?: (key: string) => void;
  className?: string;
}) {
  const [active, setActive] = useState(defaultTab || tabs[0]?.key || "");

  const handleClick = (key: string) => {
    setActive(key);
    onChange?.(key);
  };

  return (
    <div
      className={className}
      style={{
        display: "flex",
        gap: 0,
        borderBottom: "1px solid var(--border)",
      }}
    >
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <button
            key={tab.key}
            onClick={() => handleClick(tab.key)}
            style={{
              padding: "8px 16px",
              fontSize: "0.8rem",
              fontWeight: isActive ? 600 : 400,
              color: isActive ? "var(--accent)" : "var(--text-secondary)",
              borderBottom: isActive ? "2px solid var(--accent)" : "2px solid transparent",
              background: "none",
              border: "none",
              cursor: "pointer",
              transition: "color 0.15s, border-color 0.15s",
            }}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span
                style={{
                  marginLeft: 6,
                  padding: "1px 6px",
                  borderRadius: "var(--r-sm)",
                  fontSize: "0.65rem",
                  background: isActive ? "var(--accent-muted)" : "var(--bg-sunken)",
                  color: isActive ? "var(--accent)" : "var(--text-tertiary)",
                }}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
