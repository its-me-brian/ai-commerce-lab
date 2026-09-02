"use client";

import React, { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatusDot } from "@/components/ui/StatusDot";
import { EmptyState } from "@/components/ui/EmptyState";

interface AgentProfile {
  id: string;
  name: string;
  description: string;
  role: string;
  status: string;
  enabled: boolean;
  model_preference: string | null;
  department: string | null;
  config: {
    skills?: string[];
    tools?: string[];
    delegation_rules?: Record<string, unknown>;
  } | null;
}

interface AgentMemory {
  id: string;
  memory_type: string;
  content: string;
  context: string | null;
  importance: number;
  created_at: string;
}

interface AgentHandoff {
  id: string;
  from_agent_id: string;
  to_agent_id: string;
  task_type: string;
  status: string;
  created_at: string;
}

interface ModelRoute {
  id: string;
  provider: string;
  model: string;
  is_primary: boolean;
  temperature: number;
  max_tokens: number;
}

export default function AgentProfilePage() {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;

  const [agent, setAgent] = useState<AgentProfile | null>(null);
  const [memory, setMemory] = useState<AgentMemory[]>([]);
  const [handoffs, setHandoffs] = useState<AgentHandoff[]>([]);
  const [modelRoutes, setModelRoutes] = useState<ModelRoute[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"overview" | "memory" | "handoffs" | "models">("overview");

  useEffect(() => {
    async function fetchAgentData() {
      try {
        const [agentRes, memoryRes, handoffsRes, routesRes] = await Promise.all([
          fetch(`/api/agents/config?agentId=${agentId}`),
          fetch(`/api/agents/${agentId}/memory`),
          fetch(`/api/agents/${agentId}/handoffs`),
          fetch(`/api/agents/${agentId}/model-routes`),
        ]);

        const agentData = await agentRes.json();
        if (agentData.success) {
          setAgent({
            ...agentData.agent,
            config: agentData.config,
          });
        }

        const memoryData = await memoryRes.json();
        if (memoryData.success) {
          setMemory(memoryData.memory || []);
        }

        const handoffsData = await handoffsRes.json();
        if (handoffsData.success) {
          setHandoffs(handoffsData.handoffs || []);
        }

        const routesData = await routesRes.json();
        if (routesData.success) {
          setModelRoutes(routesData.routes || []);
        }
      } catch {
        console.error("Failed to load agent data");
      } finally {
        setLoading(false);
      }
    }

    if (agentId) {
      fetchAgentData();
    }
  }, [agentId]);

  if (loading) {
    return (
      <div className="p-6">
        <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>Loading...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="p-6">
        <EmptyState
          icon="🤖"
          title="Agent not found"
          description="The agent you're looking for doesn't exist"
          action={
            <Button variant="secondary" onClick={() => router.push("/workspace")}>
              Back to Workspace
            </Button>
          }
        />
      </div>
    );
  }

  const tabs = [
    { id: "overview" as const, label: "Overview" },
    { id: "memory" as const, label: `Memory (${memory.length})` },
    { id: "handoffs" as const, label: `Handoffs (${handoffs.length})` },
    { id: "models" as const, label: `Models (${modelRoutes.length})` },
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-6">
        <button
          onClick={() => router.push("/workspace")}
          className="p-2 rounded-lg hover:bg-[var(--bg-hover)] transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-bold"
          style={{ background: "var(--accent-light)", color: "var(--accent)" }}
        >
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
              {agent.name}
            </h1>
            <StatusDot status={agent.enabled ? "online" : "disabled"} size="md" />
          </div>
          <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
            {agent.role} · {agent.department || "General"}
          </p>
        </div>
        <Badge variant={agent.enabled ? "success" : "outline"}>
          {agent.enabled ? "Active" : "Disabled"}
        </Badge>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 p-1 rounded-lg" style={{ background: "var(--bg-sunken)" }}>
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className="px-4 py-2 text-xs font-medium rounded-md transition-colors"
            style={{
              background: activeTab === tab.id ? "var(--bg-card)" : "transparent",
              color: activeTab === tab.id ? "var(--text-primary)" : "var(--text-tertiary)",
              boxShadow: activeTab === tab.id ? "var(--shadow-sm)" : "none",
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Info grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <InfoCard label="Role" value={agent.role} />
            <InfoCard label="Status" value={agent.status} />
            <InfoCard label="Model" value={agent.model_preference || "Default"} />
            <InfoCard label="Department" value={agent.department || "General"} />
          </div>

          {/* Description */}
          <Card>
            <CardHeader title="Description" />
            <CardContent>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {agent.description || "No description available"}
              </p>
            </CardContent>
          </Card>

          {/* Skills & Tools */}
          {agent.config && (
            <Card>
              <CardHeader title="Capabilities" />
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.config.skills?.map((skill) => (
                    <Badge key={skill} variant="info">{skill}</Badge>
                  ))}
                  {agent.config.tools?.map((tool) => (
                    <Badge key={tool} variant="outline">{tool}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "memory" && (
        <Card>
          <CardHeader title="Agent Memory" />
          <CardContent>
            {memory.length === 0 ? (
              <EmptyState
                icon="🧠"
                title="No memories"
                description="Agent memories will appear here as the agent learns"
              />
            ) : (
              <div className="space-y-3">
                {memory.map((item) => (
                  <div
                    key={item.id}
                    className="p-3 rounded-lg"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline">{item.memory_type}</Badge>
                      <span className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
                        Importance: {item.importance}/10
                      </span>
                    </div>
                    <p className="text-xs" style={{ color: "var(--text-primary)" }}>
                      {item.content}
                    </p>
                    {item.context && (
                      <p className="text-[11px] mt-2" style={{ color: "var(--text-tertiary)" }}>
                        Context: {item.context}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "handoffs" && (
        <Card>
          <CardHeader title="Agent Handoffs" />
          <CardContent>
            {handoffs.length === 0 ? (
              <EmptyState
                icon="🤝"
                title="No handoffs"
                description="Agent handoffs will appear here when tasks are delegated"
              />
            ) : (
              <div className="space-y-2">
                {handoffs.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{item.task_type}</Badge>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
                        {item.from_agent_id.slice(0, 8)} → {item.to_agent_id.slice(0, 8)}
                      </span>
                    </div>
                    <Badge variant={item.status === "completed" ? "success" : "info"}>
                      {item.status}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "models" && (
        <Card>
          <CardHeader title="Model Routes" />
          <CardContent>
            {modelRoutes.length === 0 ? (
              <EmptyState
                icon="🔌"
                title="No model routes"
                description="Configure AI models for this agent"
              />
            ) : (
              <div className="space-y-2">
                {modelRoutes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ background: "var(--bg-sunken)" }}
                  >
                    <div className="flex items-center gap-3">
                      <div>
                        <p className="text-xs font-medium" style={{ color: "var(--text-primary)" }}>
                          {item.model}
                        </p>
                        <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                          {item.provider}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {item.is_primary && <Badge variant="info">Primary</Badge>}
                      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
                        temp: {item.temperature}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="px-4 py-3 rounded-lg"
      style={{ background: "var(--bg-sunken)", border: "1px solid var(--border-subtle)" }}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="text-sm font-medium capitalize" style={{ color: "var(--text-primary)" }}>
        {value}
      </p>
    </div>
  );
}
