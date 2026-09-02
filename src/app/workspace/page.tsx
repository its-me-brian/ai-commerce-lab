"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CompanyRoom } from "@/components/chat/CompanyRoom";
import { ChatContainer } from "@/components/chat/ChatContainer";
import type { AgentRecord } from "@/components/agents/AgentCard";

// Agent colors for avatars
const AGENT_COLORS: Record<string, string> = {
  ceo: "#f59e0b",
  producthunter: "#3b82f6",
  "product-hunter": "#3b82f6",
  marketresearch: "#ec4899",
  "market-research": "#ec4899",
  supplierresearch: "#10b981",
  "supplier-research": "#10b981",
  opportunitiescoring: "#8b5cf6",
  "opportunity-scoring": "#8b5cf6",
  storebuilder: "#14b8a6",
  "store-builder": "#14b8a6",
  marketing: "#ef4444",
  secretary: "#6b7280",
  finance: "#22c55e",
};

function getAgentColor(id: string) {
  return AGENT_COLORS[id.toLowerCase()] || "#6b7280";
}

export default function WorkspacePage() {
  const [agents, setAgents] = useState<AgentRecord[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<AgentRecord | null>(null);
  const [view, setView] = useState<"room" | "agent">("room");
  const [loading, setLoading] = useState(true);
  const [rightPanelOpen, setRightPanelOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Mobile: panels are mutually exclusive
  const toggleSidebar = () => {
    setSidebarOpen((prev) => {
      if (!prev) setRightPanelOpen(false); // close right panel when opening sidebar
      return !prev;
    });
  };
  const toggleRightPanel = () => {
    setRightPanelOpen((prev) => {
      if (!prev) setSidebarOpen(false); // close sidebar when opening right panel
      return !prev;
    });
  };

  useEffect(() => {
    async function fetchAgents() {
      try {
        const res = await fetch("/api/agents/list");
        const data = await res.json();
        if (data.success) {
          setAgents(data.agents);
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    }
    fetchAgents();
  }, []);

  const handleSendMessage = useCallback(
    async (
      message: string,
      agentId: string,
      conversationId?: string,
    ): Promise<{
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string;
      content: string;
    }> => {
      const res = await fetch("/api/agents/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId, message, conversationId }),
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(data.error || "Failed to send message");
      }
      return {
        conversationId: data.conversationId,
        userMessageId: data.userMessage?.id,
        assistantMessageId: data.assistantMessage?.id,
        content: data.assistantMessage?.content || "No response",
      };
    },
    [],
  );

  const enabledAgents = agents.filter((a) => a.enabled);
  const isRoom = view === "room";

  return (
    <div className="flex flex-1 min-h-0 relative overflow-hidden">
      {/* Mobile overlay for agent sidebar */}
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          className="fixed inset-0 z-20 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ===== LEFT: Agent sidebar ===== */}
      <div
        className={`
          fixed inset-y-0 left-0 z-30 w-[260px] flex flex-col border-r overflow-y-auto transition-transform duration-200 ease-in-out
          lg:relative lg:z-auto lg:translate-x-0 lg:w-[240px] lg:left-[var(--sidebar-w)]
          ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}
        `}
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        {/* Room header */}
        <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Rooms
          </h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="w-6 h-6 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] lg:hidden transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Company Room button */}
        <div className="px-2.5 pt-2.5 pb-0.5">
          <button
            onClick={() => { setView("room"); setSelectedAgent(null); setSidebarOpen(false); }}
            className={`w-full text-left px-2.5 py-2 rounded-[var(--r-md)] transition-colors ${
              isRoom
                ? "bg-[var(--accent-light)] text-[var(--accent)] font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-xs opacity-70">#</span>
              <span className="text-[13px]">General</span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="px-4 py-2">
          <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />
        </div>

        {/* Agents header */}
        <div className="px-4 py-0.5">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Agents
          </h2>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-2.5 pb-2.5">
          {loading ? (
            <div className="px-2.5 py-3 text-center text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Loading...
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setView("agent"); setSidebarOpen(false); }}
                className={`w-full text-left px-2.5 py-2 rounded-[var(--r-md)] mb-0.5 transition-colors ${
                  !isRoom && selectedAgent?.id === agent.id
                    ? "bg-[var(--accent-light)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="flex items-center gap-2">
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
                    style={{ background: getAgentColor(agent.id) }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-[13px] font-medium truncate block">{agent.name}</span>
                  </div>
                  <div
                    className="w-1.5 h-1.5 rounded-full shrink-0"
                    style={{ background: agent.enabled ? "var(--success)" : "var(--border-strong)" }}
                  />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-3 py-2 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {enabledAgents.length}/{agents.length} active
          </p>
        </div>
      </div>

      {/* ===== CENTER: Chat area ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile toolbar: sidebar toggle + right panel toggle */}
        <div className="flex items-center gap-2 px-3 py-2 border-b lg:hidden shrink-0" style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}>
          <button
            onClick={toggleSidebar}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] hover:bg-[var(--bg-hover)] transition-colors"
            style={{ color: sidebarOpen ? "var(--accent)" : "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M3 12h18M3 6h18M3 18h18" />
            </svg>
          </button>
          <div className="flex-1" />
          <button
            onClick={toggleRightPanel}
            className="w-8 h-8 flex items-center justify-center rounded-[var(--r-md)] hover:bg-[var(--bg-hover)] transition-colors"
            style={{ color: rightPanelOpen ? "var(--accent)" : "var(--text-secondary)" }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />
            </svg>
          </button>
        </div>

        {isRoom ? (
          <CompanyRoom workspaceId="default" agents={agents} onTogglePanel={toggleRightPanel} panelOpen={rightPanelOpen} />
        ) : selectedAgent ? (
          <ChatContainer
            agents={agents}
            selectedAgentId={selectedAgent.id}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Select an agent to start chatting
            </p>
          </div>
        )}
      </div>

      {/* ===== Mobile right panel overlay ===== */}
      {rightPanelOpen && (
        <div
          onClick={toggleRightPanel}
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
        />
      )}

      {/* ===== RIGHT: Context panel (collapsible) ===== */}
      <div
        className={`
          fixed inset-y-0 right-0 z-50 w-[300px] flex flex-col border-l overflow-y-auto transition-transform duration-200 ease-in-out
          lg:relative lg:z-auto lg:shrink-0 lg:h-full
          ${rightPanelOpen ? "translate-x-0" : "translate-x-full"}
          ${rightPanelOpen ? "" : "lg:hidden"}
        `}
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        {/* Mobile close button */}
        <div className="px-4 py-2 flex justify-end lg:hidden shrink-0">
          <button
            onClick={toggleRightPanel}
            className="w-7 h-7 flex items-center justify-center rounded hover:bg-[var(--bg-hover)] transition-colors"
            style={{ color: "var(--text-tertiary)" }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        {isRoom ? (
          /* ── Room Context ── */
          <div className="flex flex-col gap-4 p-4">
            {/* About room */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
                About
              </h3>
              <div className="space-y-2.5">
                <InfoRow label="Purpose" value="Company-wide AI collaboration" />
                <InfoRow label="Created by" value="CEO" />
                <InfoRow label="Type" value="Public — all agents" />
              </div>
            </div>

            <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

            {/* Quick commands reference */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
                Quick Commands
              </h3>
              <div className="space-y-1.5">
                <CommandRow command="@ceo" description="Direct message to CEO Agent" />
                <CommandRow command="@product-hunter" description="Ask about product opportunities" />
                <CommandRow command="@finance" description="Financial analysis & budgets" />
                <CommandRow command="@marketing" description="Marketing strategy & campaigns" />
              </div>
            </div>

            <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

            {/* Quick Actions */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
                Quick Actions
              </h3>
              <div className="flex flex-col gap-1.5">
                <a
                  href="/workspace/settings"
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                  </svg>
                  Configure Agents
                </a>
                <a
                  href="/dashboard/agents"
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="8.5" cy="7" r="4" /><line x1="20" y1="8" x2="20" y2="14" /><line x1="23" y1="11" x2="17" y2="11" />
                  </svg>
                  Agent Dashboard
                </a>
                <a
                  href="/dashboard/test-center"
                  className="flex items-center gap-2 px-2.5 py-2 rounded-[var(--r-md)] text-[12px] font-medium transition-colors hover:bg-[var(--bg-hover)]"
                  style={{ color: "var(--text-secondary)", textDecoration: "none" }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
                  </svg>
                  Test Center
                </a>
              </div>
            </div>

            <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

            {/* §33: Participants panel */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
                Participants ({enabledAgents.length})
              </h3>
              <div className="space-y-1">
                {enabledAgents.map((agent) => (
                  <div
                    key={agent.id}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-[var(--r-md)]"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white shrink-0"
                      style={{ background: getAgentColor(agent.id) }}
                    >
                      {agent.name.charAt(0)}
                    </div>
                    <span className="text-[12px] truncate" style={{ color: "var(--text-secondary)" }}>
                      {agent.name}
                    </span>
                    <div
                      className="w-1.5 h-1.5 rounded-full shrink-0 ml-auto"
                      style={{ background: agent.enabled ? "var(--success)" : "var(--border-strong)" }}
                    />
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

            {/* System status */}
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
                System Status
              </h3>
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--success)" }} />
                <span className="text-[11px]" style={{ color: "var(--success)" }}>
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        ) : selectedAgent ? (
          /* ── Agent Profile ── */
          <AgentProfilePanel agent={selectedAgent} />
        ) : (
          <div className="flex-1 flex items-center justify-center p-4">
            <p className="text-xs text-center" style={{ color: "var(--text-tertiary)" }}>
              Select an agent or room to see context
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Agent Profile Panel ──────────────────────────────────────────
function AgentProfilePanel({ agent }: { agent: AgentRecord }) {
  const color = getAgentColor(agent.id);
  const skills = agent.config?.skills || [];
  const tools = agent.config?.tools || [];

  return (
    <div className="flex flex-col gap-4 p-4">
      {/* Agent header */}
      <div className="flex items-center gap-3">
        <div
          className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0"
          style={{ background: color }}
        >
          {agent.name.charAt(0)}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
            {agent.name}
          </h3>
          <div className="flex items-center gap-1.5">
            <div
              className="w-1.5 h-1.5 rounded-full"
              style={{ background: agent.enabled ? "var(--success)" : "var(--border-strong)" }}
            />
            <span className="text-[11px]" style={{ color: agent.enabled ? "var(--success)" : "var(--text-tertiary)" }}>
              {agent.enabled ? "Online" : "Offline"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

      {/* Role */}
      <ProfileSection title="Role" value={agent.role} />

      {/* Description / Mission */}
      {agent.description && (
        <ProfileSection title="Mission" value={agent.description} />
      )}

      {/* Department */}
      {agent.department && (
        <ProfileSection title="Department" value={agent.department} />
      )}

      {/* Model */}
      {agent.model_preference && (
        <ProfileSection title="Model" value={agent.model_preference} />
      )}

      {/* Skills */}
      {skills.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
            Skills ({skills.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {skills.map((skill) => (
              <span
                key={skill}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}
              >
                {skill}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tools */}
      {tools.length > 0 && (
        <div>
          <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--text-tertiary)" }}>
            Tools ({tools.length})
          </h4>
          <div className="flex flex-wrap gap-1">
            {tools.map((tool) => (
              <span
                key={tool}
                className="text-[10px] px-1.5 py-0.5 rounded"
                style={{ background: "var(--bg-sunken)", color: "var(--text-secondary)" }}
              >
                {tool}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Config status */}
      <div className="border-t pt-3" style={{ borderColor: "var(--border-subtle)" }}>
        <div className="space-y-1.5">
          <ConfigRow label="Config" value={agent.config ? "Loaded" : "Default"} ok={!!agent.config} />
          <ConfigRow label="Status" value={agent.status} ok={agent.status === "ready"} />
        </div>
      </div>

      {/* Action buttons */}
      <div className="border-t pt-3 flex flex-col gap-2" style={{ borderColor: "var(--border-subtle)" }}>
        <a
          href={`/workspace/agents/${agent.id}`}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium transition-colors"
          style={{
            background: "var(--accent-light)",
            color: "var(--accent)",
            textDecoration: "none",
          }}
        >
          View Configuration
        </a>
        <a
          href={`/dashboard/agents/${agent.id}`}
          className="flex items-center justify-center gap-2 px-3 py-2 rounded-[var(--r-md)] text-[13px] font-medium border transition-colors"
          style={{
            borderColor: "var(--border)",
            color: "var(--text-secondary)",
            textDecoration: "none",
          }}
        >
          Edit Agent
        </a>
      </div>
    </div>
  );
}

function ProfileSection({ title, value }: { title: string; value: string }) {
  return (
    <div>
      <h4 className="text-[10px] font-semibold uppercase tracking-wider mb-1" style={{ color: "var(--text-tertiary)" }}>
        {title}
      </h4>
      <p className="text-[13px]" style={{ color: "var(--text-secondary)" }}>
        {value}
      </p>
    </div>
  );
}

function ConfigRow({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>{label}</span>
      <span className="text-[11px] font-medium" style={{ color: ok ? "var(--success)" : "var(--text-tertiary)" }}>
        {value}
      </span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="text-[12px]" style={{ color: "var(--text-secondary)" }}>
        {value}
      </p>
    </div>
  );
}

function CommandRow({ command, description }: { command: string; description: string }) {
  return (
    <div className="flex items-center gap-2">
      <code className="text-[11px] font-mono px-1.5 py-0.5 rounded shrink-0" style={{ background: "var(--bg-sunken)", color: "var(--accent)", border: "1px solid var(--border-subtle)" }}>
        {command}
      </code>
      <span className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
        {description}
      </span>
    </div>
  );
}
