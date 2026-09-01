"use client";

import React from "react";
import { Badge } from "../ui/Badge";
import { StatusDot } from "../ui/StatusDot";
import { Card } from "../ui/Card";

export interface AgentRecord {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  role: string;
  status: string;
  model_preference?: string | null;
  department?: string | null;
  config?: AgentConfigRecord | null;
}

export interface AgentConfigRecord {
  description?: string;
  role?: string;
  skills?: string[];
  tools?: string[];
  delegation_rules?: Record<string, unknown>;
}

interface AgentCardProps {
  agent: AgentRecord;
  selected?: boolean;
  onSelect?: () => void;
  showConfig?: boolean;
}

function getAgentStatus(
  enabled?: boolean,
  devStatus?: string,
): "online" | "working" | "idle" | "warning" | "error" | "disabled" {
  if (!enabled) return "disabled";
  if (devStatus === "development") return "idle";
  return "online";
}

const ROLE_LABELS: Record<string, string> = {
  manager: "Manager",
  assistant: "Assistant",
  operator: "Operator",
  coordinator: "Coordinator",
};

const ROLE_COLORS: Record<string, "info" | "success" | "warning" | "default"> = {
  manager: "info",
  assistant: "success",
  operator: "warning",
  coordinator: "default",
};

export function AgentCard({ agent, selected, onSelect, showConfig }: AgentCardProps) {
  const status = getAgentStatus(agent.enabled, agent.status);
  const roleKey = agent.config?.role ?? agent.role ?? "assistant";

  return (
    <Card
      className={`p-4 transition-all ${selected ? "ring-2 ring-[var(--accent)]" : ""} ${onSelect ? "cursor-pointer" : ""}`}
      style={{
        borderColor: selected ? "var(--accent)" : undefined,
      }}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {agent.name}
            </h3>
            <StatusDot status={status} />
          </div>
          <p className="text-xs mt-1 line-clamp-2" style={{ color: "var(--text-secondary)" }}>
            {agent.config?.description ?? agent.description ?? "No description"}
          </p>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant={ROLE_COLORS[roleKey] ?? "default"}>
              {ROLE_LABELS[roleKey] ?? roleKey}
            </Badge>
            {agent.model_preference && (
              <Badge variant="outline">{agent.model_preference}</Badge>
            )}
          </div>
          {showConfig && agent.config && (
            <div className="mt-3 pt-3" style={{ borderTop: "1px solid var(--border-subtle)" }}>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Skills: </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {agent.config.skills?.length ?? 0}
                  </span>
                </div>
                <div>
                  <span style={{ color: "var(--text-tertiary)" }}>Tools: </span>
                  <span style={{ color: "var(--text-secondary)" }}>
                    {agent.config.tools?.length ?? 0}
                  </span>
                </div>
                {agent.config.delegation_rules && (
                  <div className="col-span-2">
                    <span style={{ color: "var(--text-tertiary)" }}>Delegation: </span>
                    <span style={{ color: "var(--text-secondary)" }}>
                      {Object.keys(agent.config.delegation_rules).length} rule(s)
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}
