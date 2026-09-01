"use client";

import React from "react";
import type { AgentRecord } from "./AgentCard";

interface AgentSelectorProps {
  agents: AgentRecord[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export function AgentSelector({ agents, selectedId, onSelect }: AgentSelectorProps) {
  const enabledAgents = agents.filter((a) => a.enabled !== false);

  return (
    <div
      className="flex items-center gap-2 p-2 rounded-[var(--r-md)]"
      style={{ background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)" }}
    >
      <span className="text-xs font-medium pl-2" style={{ color: "var(--text-tertiary)" }}>
        Agent:
      </span>
      <div className="flex flex-wrap gap-1">
        {enabledAgents.map((agent) => (
          <button
            key={agent.id}
            onClick={() => onSelect(agent.id)}
            className="px-2.5 py-1 text-xs font-medium rounded-[var(--r-sm)] transition-colors"
            style={{
              background: selectedId === agent.id ? "var(--accent)" : "var(--bg-card)",
              color: selectedId === agent.id ? "var(--text-inverse)" : "var(--text-secondary)",
              border: selectedId === agent.id ? undefined : "1px solid var(--border-subtle)",
            }}
          >
            {agent.name}
          </button>
        ))}
      </div>
    </div>
  );
}
