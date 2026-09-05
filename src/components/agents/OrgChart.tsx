"use client";

import React, { useState } from "react";
import { StatusDot } from "@/components/ui/StatusDot";

interface AgentNode {
  id: string;
  name: string;
  description: string | null;
  status: string;
  enabled: boolean;
  agent_type: string | null;
  department: string | null;
}

interface OrgChartProps {
  roots: AgentNode[];
  childrenMap: Map<string, AgentNode[]>;
  configMap: Map<string, { primary_model_id: string; primary_provider_id: string }>;
  modelMap: Map<string, string>;
}

export function OrgChart({ roots, childrenMap, configMap, modelMap }: OrgChartProps) {
  return (
    <div
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-lg)",
        padding: 24,
        marginBottom: 20,
      }}
    >
      <h2 style={{ fontSize: "0.875rem", fontWeight: 600, marginBottom: 16 }}>
        Organization Chart
      </h2>
      <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
        {roots.map((agent) => (
          <TreeNode
            key={agent.id}
            agent={agent}
            childrenMap={childrenMap}
            configMap={configMap}
            modelMap={modelMap}
            depth={0}
            _isLast={false}
          />
        ))}
      </div>
    </div>
  );
}

function TreeNode({
  agent,
  childrenMap,
  configMap,
  modelMap,
  depth,
  _isLast,
}: {
  agent: AgentNode;
  childrenMap: Map<string, AgentNode[]>;
  configMap: Map<string, { primary_model_id: string; primary_provider_id: string }>;
  modelMap: Map<string, string>;
  depth: number;
  _isLast: boolean;
}) {
  const children = childrenMap.get(agent.id) || [];
  const hasChildren = children.length > 0;
  const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
  const cfg = configMap.get(agent.id);
  const modelName = cfg ? modelMap.get(cfg.primary_model_id) || "-" : "-";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 12px",
          marginLeft: depth * 28,
          borderRadius: "var(--r-md)",
          background: depth === 0 ? "var(--bg-sunken)" : "transparent",
          position: "relative",
          cursor: hasChildren ? "pointer" : "default",
          transition: "background 0.15s",
        }}
        onClick={() => hasChildren && setExpanded(!expanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (hasChildren) setExpanded(!expanded);
          }
        }}
        role="button"
        tabIndex={0}
        aria-expanded={hasChildren ? expanded : undefined}
        onMouseEnter={(e) => {
          if (hasChildren) e.currentTarget.style.background = "var(--bg-hover)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = depth === 0 ? "var(--bg-sunken)" : "transparent";
        }}
      >
        {/* Tree connector line */}
        {depth > 0 && (
          <div
            style={{
              position: "absolute",
              left: -16,
              top: "50%",
              width: 12,
              height: 1,
              background: "var(--border-strong)",
            }}
          />
        )}

        {/* Chevron / spacer */}
        {hasChildren ? (
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            stroke="var(--text-tertiary)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              flexShrink: 0,
              transition: "transform 0.2s",
              transform: expanded ? "rotate(90deg)" : "rotate(0deg)",
            }}
          >
            <path d="M5 3l4 4-4 4" />
          </svg>
        ) : (
          <div style={{ width: 14, flexShrink: 0 }} />
        )}

        <StatusDot status={!agent.enabled ? "disabled" : agent.status === "ready" ? "online" : agent.status === "error" ? "error" : "online"} />

        <span
          style={{
            fontWeight: depth === 0 ? 600 : 400,
            fontSize: "0.8125rem",
            color: "var(--text-primary)",
          }}
        >
          {agent.name}
        </span>

        {agent.department && (
          <span
            style={{
              fontSize: "0.5625rem",
              fontWeight: 600,
              letterSpacing: "0.04em",
              padding: "1px 5px",
              borderRadius: 4,
              background: "var(--accent-light)",
              color: "var(--accent)",
            }}
          >
            {agent.department}
          </span>
        )}

        {hasChildren && (
          <span
            style={{
              fontSize: "0.625rem",
              color: "var(--text-tertiary)",
              marginLeft: 4,
            }}
          >
            {children.length}
          </span>
        )}

        <span
          style={{
            fontSize: "0.6875rem",
            color: "var(--text-tertiary)",
            marginLeft: "auto",
          }}
        >
          {modelName}
        </span>
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div style={{ position: "relative" }}>
          {/* Vertical connector line */}
          <div
            style={{
              position: "absolute",
              left: depth * 28 + 18,
              top: 0,
              bottom: 8,
              width: 1,
              background: "var(--border-strong)",
            }}
          />
          {children.map((child, i) => (
            <TreeNode
              key={child.id}
              agent={child}
              childrenMap={childrenMap}
              configMap={configMap}
              modelMap={modelMap}
              depth={depth + 1}
              _isLast={i === children.length - 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Removed local StatusDot — use canonical from @/components/ui/StatusDot
