"use client";

import React, { useState, useEffect, useCallback } from "react";
import { CompanyRoom } from "@/components/chat/CompanyRoom";
import { ChatContainer } from "@/components/chat/ChatContainer";

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

  return (
    <div className="flex h-[calc(100vh-var(--header-h))]">
      {/* ===== LEFT: Agent sidebar (inside workspace) ===== */}
      <div
        className="w-[260px] shrink-0 flex flex-col border-r overflow-y-auto"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        {/* Room header */}
        <div className="px-5 py-4 border-b" style={{ borderColor: "var(--border-subtle)" }}>
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Salas
          </h2>
        </div>

        {/* Company Room button */}
        <div className="px-3 pt-3 pb-1">
          <button
            onClick={() => setView("room")}
            className={`w-full text-left px-3 py-2.5 rounded-[var(--r-md)] transition-colors ${
              view === "room"
                ? "bg-[var(--accent-light)] text-[var(--accent)] font-medium"
                : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className="text-sm opacity-70">#</span>
              <span className="text-sm">Sala General</span>
            </div>
          </button>
        </div>

        {/* Divider */}
        <div className="px-5 py-3">
          <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />
        </div>

        {/* Agents header */}
        <div className="px-5 py-1">
          <h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
            Agentes IA
          </h2>
        </div>

        {/* Agent list */}
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          {loading ? (
            <div className="px-3 py-4 text-center text-xs" style={{ color: "var(--text-tertiary)" }}>
              Cargando...
            </div>
          ) : (
            agents.map((agent) => (
              <button
                key={agent.id}
                onClick={() => { setSelectedAgent(agent); setView("agent"); }}
                className={`w-full text-left px-3 py-2.5 rounded-[var(--r-md)] mb-1.5 transition-colors ${
                  view === "agent" && selectedAgent?.id === agent.id
                    ? "bg-[var(--accent-light)] text-[var(--accent)]"
                    : "text-[var(--text-secondary)] hover:bg-[var(--bg-hover)]"
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {/* Avatar */}
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
                    style={{ background: getAgentColor(agent.id) }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-medium truncate">{agent.name}</span>
                    </div>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      {agent.role}
                    </p>
                  </div>
                  {/* Online dot */}
                  <div
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ background: agent.enabled ? "var(--success)" : "var(--border-strong)" }}
                  />
                </div>
              </button>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t" style={{ borderColor: "var(--border-subtle)" }}>
          <p className="text-[10px]" style={{ color: "var(--text-tertiary)" }}>
            {enabledAgents.length} de {agents.length} agentes activos
          </p>
        </div>
      </div>

      {/* ===== CENTER: Chat area ===== */}
      <div className="flex-1 flex flex-col min-w-0">
        {view === "room" ? (
          <CompanyRoom workspaceId="default" agents={agents} />
        ) : selectedAgent ? (
          <ChatContainer
            agents={agents}
            selectedAgentId={selectedAgent.id}
            onSendMessage={handleSendMessage}
          />
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <p className="text-sm" style={{ color: "var(--text-tertiary)" }}>
              Seleccioná un agente para empezar
            </p>
          </div>
        )}
      </div>

      {/* ===== RIGHT: Participants panel ===== */}
      <div
        className="w-[260px] shrink-0 flex flex-col border-l overflow-y-auto hidden lg:flex"
        style={{ borderColor: "var(--border-subtle)", background: "var(--bg-card)" }}
      >
        <div className="flex flex-col gap-5 p-5">
          {/* Participants */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
              Participantes ({enabledAgents.length})
            </h3>
            <div className="space-y-3">
              {enabledAgents.map((agent) => (
                <div key={agent.id} className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold text-white shrink-0"
                    style={{ background: getAgentColor(agent.id) }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
                      {agent.name}
                    </p>
                    <p className="text-[11px] truncate" style={{ color: "var(--text-tertiary)" }}>
                      {agent.role}
                    </p>
                  </div>
                  <div className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
                </div>
              ))}
            </div>
          </div>

          <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

          {/* Room info */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: "var(--text-tertiary)" }}>
              Información
            </h3>
            <div className="space-y-3">
              <InfoRow label="Propósito" value="Comunicación y colaboración del equipo AI" />
              <InfoRow label="Creado por" value="CEO" />
              <InfoRow label="Configuración" value="Pública para todos los agentes" />
            </div>
          </div>

          <div className="border-t" style={{ borderColor: "var(--border-subtle)" }} />

          {/* System status */}
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: "var(--text-tertiary)" }}>
              Estado del Sistema
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ background: "var(--success)" }} />
              <span className="text-xs" style={{ color: "var(--success)" }}>
                Todos los sistemas operativos
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>
        {label}
      </p>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {value}
      </p>
    </div>
  );
}
