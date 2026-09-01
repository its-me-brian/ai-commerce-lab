"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { WorkspaceLayout } from "@/components/workspace/WorkspaceLayout";
import { ChatContainer } from "@/components/chat/ChatContainer";
import { ActivityFeed } from "@/components/activity/ActivityFeed";
import { CEOOrchestrationPanel } from "@/components/workspace/CEOOrchestrationPanel";
import { ProductSearchPanel } from "@/components/products/ProductSearchPanel";
import { Card, CardHeader, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";

interface AgentRecord {
  id: string;
  name: string;
  description: string | null;
  enabled: boolean;
  role: string;
  status: string;
  model_preference?: string | null;
  department?: string | null;
  config?: {
    description?: string;
    role?: string;
    skills?: string[];
    tools?: string[];
  } | null;
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents/list");
        const data = await res.json();
        if (data.success) {
          setAgents(data.agents);
          const firstEnabled = data.agents.find((a: AgentRecord) => a.enabled);
          if (firstEnabled) {
            setSelectedAgent(firstEnabled);
          }
        } else {
          setError(data.error || "Failed to load agents");
        }
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load agents");
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const handleSendMessage = useCallback(
    async (message: string, agentId: string): Promise<string> => {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, message }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to send message");
      }
      return data.assistantMessage?.content || "No response";
    },
    [],
  );

  // Sidebar: Clean agent list
  const sidebar = (
    <div className="flex flex-col h-full">
      {/* Logo */}
      <div className="px-4 py-4 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-[var(--accent)]">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2L2 7l10 5 10-5-10-5z" />
              <path d="M2 17l10 5 10-5" />
              <path d="M2 12l10 5 10-5" />
            </svg>
          </div>
          <div>
            <h1 className="text-sm font-semibold text-[var(--text-primary)]">
              AI Commerce Lab
            </h1>
            <p className="text-[10px] text-[var(--text-tertiary)]">Workspace</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="px-2 py-2">
        <NavLink href="/workspace" icon="home" label="Workspace" />
        <NavLink href="/workspace/settings" icon="settings" label="Settings" />
        <NavLink href="/dashboard" icon="dashboard" label="Dashboard" />
      </nav>

      {/* Divider */}
      <div className="px-4 py-2">
        <div className="border-t border-[var(--border-subtle)]" />
      </div>

      {/* Agent list header */}
      <div className="px-4 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-tertiary)]">
          Agents
        </h2>
      </div>

      {/* Agent list */}
      <div className="flex-1 overflow-y-auto px-2">
        {loading ? (
          <div className="px-2 py-4 text-center text-xs text-[var(--text-tertiary)]">
            Loading...
          </div>
        ) : error ? (
          <div className="px-2 py-4 text-center text-xs text-[var(--error)]">
            {error}
          </div>
        ) : agents.length === 0 ? (
          <div className="px-2 py-8 text-center">
            <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--bg-sunken)] flex items-center justify-center">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="var(--text-tertiary)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M6 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2" />
              </svg>
            </div>
            <p className="text-xs text-[var(--text-tertiary)] mb-2">No agents deployed</p>
            <p className="text-[10px] text-[var(--text-tertiary)]">Create one from the dashboard</p>
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.id}
              onClick={() => setSelectedAgent(agent)}
              className={`w-full text-left px-3 py-2.5 rounded-lg mb-0.5 transition-colors ${
                selectedAgent?.id === agent.id
                  ? "bg-[var(--accent-light)] text-[var(--accent)]"
                  : "text-[var(--text-primary)] hover:bg-[var(--bg-hover)]"
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className={`w-2 h-2 rounded-full shrink-0 ${
                    agent.enabled ? "bg-[var(--success)]" : "bg-[var(--border-strong)]"
                  }`}
                />
                <span className="text-sm font-medium truncate">{agent.name}</span>
              </div>
              <p className="text-[11px] mt-0.5 truncate pl-4 text-[var(--text-tertiary)]">
                {agent.role}
              </p>
            </button>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-[var(--border-subtle)]">
        <p className="text-[10px] text-[var(--text-tertiary)]">
          {agents.filter((a) => a.enabled).length} of {agents.length} agents active
        </p>
      </div>
    </div>
  );

  // Header
  const header = selectedAgent ? (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold bg-[var(--accent-light)] text-[var(--accent)]">
        {selectedAgent.name.charAt(0)}
      </div>
      <div>
        <h1 className="text-sm font-semibold text-[var(--text-primary)]">
          {selectedAgent.name}
        </h1>
        <p className="text-xs text-[var(--text-tertiary)]">
          {selectedAgent.role} · {selectedAgent.department || "General"}
        </p>
      </div>
      <Badge variant={selectedAgent.enabled ? "success" : "outline"}>
        {selectedAgent.enabled ? "Active" : "Disabled"}
      </Badge>
    </div>
  ) : (
    <div className="text-sm text-[var(--text-tertiary)]">
      Select an agent to get started
    </div>
  );

  // Right panel: Chat
  const rightPanel = selectedAgent ? (
    <ChatContainer
      agents={agents}
      selectedAgentId={selectedAgent.id}
      onSendMessage={handleSendMessage}
    />
  ) : (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon="💬"
        title="Select an agent"
        description="Choose an agent from the sidebar to start chatting"
      />
    </div>
  );

  // Main content
  const mainContent = selectedAgent ? (
    <div className="p-6 space-y-6">
      {/* Agent info */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <InfoCard label="Role" value={selectedAgent.role} />
        <InfoCard label="Status" value={selectedAgent.status} />
        <InfoCard label="Model" value={selectedAgent.model_preference || "Default"} />
        <InfoCard label="Department" value={selectedAgent.department || "General"} />
      </div>

      {/* Skills & Tools */}
      {selectedAgent.config && (
        <Card>
          <CardHeader title="Capabilities" />
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {selectedAgent.config.skills?.map((skill) => (
                <Badge key={skill} variant="info">{skill}</Badge>
              ))}
              {selectedAgent.config.tools?.map((tool) => (
                <Badge key={tool} variant="outline">{tool}</Badge>
              ))}
              {!selectedAgent.config.skills?.length && !selectedAgent.config.tools?.length && (
                <p className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                  No skills or tools configured
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CEOOrchestrationPanel />
        <ProductSearchPanel />
      </div>

      {/* Activity */}
      <ActivityFeed limit={6} />
    </div>
  ) : (
    <div className="flex items-center justify-center h-full">
      <EmptyState
        icon="🤖"
        title="Welcome to Workspace"
        description="Select an agent from the sidebar to view details and start chatting"
      />
    </div>
  );

  return (
    <WorkspaceLayout
      sidebar={sidebar}
      header={header}
      rightPanel={rightPanel}
    >
      {mainContent}
    </WorkspaceLayout>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="px-4 py-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border-subtle)]">
      <p className="text-[10px] font-semibold uppercase tracking-wider mb-1 text-[var(--text-tertiary)]">
        {label}
      </p>
      <p className="text-sm font-medium capitalize text-[var(--text-primary)]">
        {value}
      </p>
    </div>
  );
}

function NavLink({ href, icon, label }: { href: string; icon: string; label: string }) {
  const pathname = usePathname();
  const isActive = pathname === href;

  const icons: Record<string, React.ReactNode> = {
    home: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
        <polyline points="9 22 9 12 15 12 15 22" />
      </svg>
    ),
    settings: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="12" cy="12" r="3" />
        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
      </svg>
    ),
    dashboard: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  };

  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-[var(--accent-light)] text-[var(--accent)]"
          : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
      }`}
    >
      {icons[icon]}
      {label}
    </Link>
  );
}
