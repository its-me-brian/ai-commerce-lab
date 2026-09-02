"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
import type { AgentRecord } from "../agents/AgentCard";
import { Badge } from "../ui/Badge";
import { formatTime } from "@/lib/utils/format";

// Agent color mapping for visual differentiation
const AGENT_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  ceo: { bg: "#fef3c7", text: "#92400e", border: "#f59e0b" },
  producthunter: { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  "product-hunter": { bg: "#dbeafe", text: "#1e40af", border: "#3b82f6" },
  marketresearch: { bg: "#fce7f3", text: "#9d174d", border: "#ec4899" },
  "market-research": { bg: "#fce7f3", text: "#9d174d", border: "#ec4899" },
  supplierresearch: { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  "supplier-research": { bg: "#d1fae5", text: "#065f46", border: "#10b981" },
  opportunitiescoring: { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
  "opportunity-scoring": { bg: "#ede9fe", text: "#5b21b6", border: "#8b5cf6" },
  storebuilder: { bg: "#ccfbf1", text: "#0f766e", border: "#14b8a6" },
  "store-builder": { bg: "#ccfbf1", text: "#0f766e", border: "#14b8a6" },
  marketing: { bg: "#fee2e2", text: "#991b1b", border: "#ef4444" },
  secretary: { bg: "#f3f4f6", text: "#374151", border: "#6b7280" },
  finance: { bg: "#ecfdf5", text: "#065f46", border: "#22c55e" },
};

function getAgentColor(agentId: string) {
  return AGENT_COLORS[agentId.toLowerCase()] || { bg: "#f3f4f6", text: "#374151", border: "#6b7280" };
}

interface RoomMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  agentName?: string;
  agentId?: string;
  timestamp: string;
}

interface CompanyRoomProps {
  workspaceId: string;
  agents: AgentRecord[];
  onTogglePanel?: () => void;
  panelOpen?: boolean;
}

export function CompanyRoom({ workspaceId, agents, onTogglePanel, panelOpen }: CompanyRoomProps) {
  const [messages, setMessages] = useState<RoomMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionFilter, setMentionFilter] = useState("");
  const [input, setInput] = useState("");
  const [focused, setFocused] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const loadingRef = useRef(false);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // Load room conversation on mount
  useEffect(() => {
    if (!workspaceId) return;
    let cancelled = false;

    async function loadRoom() {
      setLoadingHistory(true);
      try {
        const res = await fetch(`/api/conversations/room?workspaceId=${encodeURIComponent(workspaceId)}`);
        const data = await res.json();
        if (cancelled) return;

        if (data.success && data.conversation) {
          setConversationId(data.conversation.id);

          // Load existing messages
          if (data.messages && data.messages.length > 0) {
            const mapped: RoomMessage[] = data.messages.map(
              (m: { id: string; role: string; content: string; created_at: string; metadata?: Record<string, unknown> }) => ({
                id: m.id,
                role: m.role as "user" | "assistant" | "system",
                content: m.content,
                agentName: m.metadata?.agentName as string | undefined,
                agentId: m.metadata?.agentId as string | undefined,
                timestamp: m.created_at,
              })
            );
            setMessages(mapped);
          }
        }
        // If no room exists yet, we start empty — room created on first message
      } catch {
        // Silently fail — messages start empty
      } finally {
        if (!cancelled) setLoadingHistory(false);
      }
    }

    loadRoom();
    return () => { cancelled = true; };
  }, [workspaceId]);

  // Load messages when conversationId changes
  useEffect(() => {
    if (!conversationId) return;
    let cancelled = false;

    fetch(`/api/conversations/${conversationId}/messages`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data.success && data.messages) {
          const mapped: RoomMessage[] = data.messages.map(
            (m: { id: string; role: string; content: string; created_at: string; metadata?: Record<string, unknown> }) => ({
              id: m.id,
              role: m.role as "user" | "assistant" | "system",
              content: m.content,
              agentName: m.metadata?.agentName as string | undefined,
              agentId: m.metadata?.agentId as string | undefined,
              timestamp: m.created_at,
            })
          );
          setMessages(mapped);
        }
      })
      .catch(() => {})
      .finally(() => { if (!cancelled) setLoadingHistory(false); });

    return () => { cancelled = true; };
  }, [conversationId]);

  // Parse @mentions from input
  const filteredAgents = agents.filter(
    (a) =>
      a.enabled !== false &&
      (a.id.toLowerCase().includes(mentionFilter.toLowerCase()) ||
        a.name.toLowerCase().includes(mentionFilter.toLowerCase()))
  );

  const handleInputChange = (value: string) => {
    setInput(value);
    // Detect @mention
    const lastAt = value.lastIndexOf("@");
    if (lastAt >= 0 && lastAt === value.length - 1) {
      setShowMentions(true);
      setMentionFilter("");
    } else if (lastAt >= 0) {
      const afterAt = value.slice(lastAt + 1);
      if (!afterAt.includes(" ")) {
        setShowMentions(true);
        setMentionFilter(afterAt);
      } else {
        setShowMentions(false);
      }
    } else {
      setShowMentions(false);
    }
  };

  const selectMention = (agent: AgentRecord) => {
    const lastAt = input.lastIndexOf("@");
    const before = input.slice(0, lastAt);
    setInput(`${before}@${agent.id} `);
    setShowMentions(false);
    textareaRef.current?.focus();
  };

  const handleSend = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loadingRef.current) return;

    // Parse @mention
    const mentionMatch = trimmed.match(/^@(\S+)\s*(.*)/);
    const targetAgentId = mentionMatch ? mentionMatch[1] : "ceo";
    const message = mentionMatch ? mentionMatch[2] : trimmed;

    if (!message) return;

    loadingRef.current = true;
    setLoading(true);
    setInput("");

    // Optimistic user message
    const tempId = `temp-${Date.now()}`;
    const userMsg: RoomMessage = {
      id: tempId,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);

    try {
      const res = await fetch("/api/conversations/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          message,
          targetAgentId,
        }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      // Update conversation ID
      if (data.conversationId && !conversationId) {
        setConversationId(data.conversationId);
      }

      // Replace temp ID with real ID
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: data.userMessage?.id || tempId }
            : m
        )
      );

      // Add agent response
      const agent = agents.find((a) => a.id === targetAgentId);
      const assistantMsg: RoomMessage = {
        id: data.assistantMessage?.id || `asst-${Date.now()}`,
        role: "assistant",
        content: data.assistantMessage?.content || "No response",
        agentName: agent?.name || targetAgentId,
        agentId: targetAgentId,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === tempId
            ? { ...m, id: `error-${Date.now()}`, role: "system" as const, content: "Failed to send message." }
            : m
        )
      );
    } finally {
      setLoading(false);
      loadingRef.current = false;
    }
  }, [input, workspaceId, agents, conversationId]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Room header */}
      <div
        className="px-6 py-4 shrink-0 flex items-center justify-between"
        style={{ borderBottom: "1px solid var(--border-subtle)", background: "var(--bg-card)" }}
      >
        <div className="flex items-center gap-3">
          <span className="text-lg" style={{ color: "var(--text-tertiary)" }}>#</span>
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              Sala General
            </h2>
            <p className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
              Canal general para toda la organización
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[11px]" style={{ color: "var(--text-tertiary)" }}>
            {agents.filter((a) => a.enabled !== false).length} miembros
          </span>
          <div className="flex items-center -space-x-1.5">
            {agents.filter((a) => a.enabled !== false).slice(0, 5).map((agent) => {
              const colors = getAgentColor(agent.id);
              return (
                <div
                  key={agent.id}
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-white"
                  style={{ background: colors.bg, color: colors.text }}
                  title={agent.name}
                >
                  {agent.name.charAt(0)}
                </div>
              );
            })}
          </div>
          {/* Panel toggle — desktop only */}
          {onTogglePanel && (
            <button
              onClick={onTogglePanel}
              className="hidden lg:flex w-7 h-7 items-center justify-center rounded-[var(--r-md)] hover:bg-[var(--bg-hover)] transition-colors ml-1"
              style={{ color: panelOpen ? "var(--accent)" : "var(--text-tertiary)" }}
              title={panelOpen ? "Hide info panel" : "Show info panel"}
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="3" width="18" height="18" rx="2" /><path d="M15 3v18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5">
        {messages.length === 0 && !loadingHistory && (
          <div className="flex-1 flex flex-col items-center justify-center py-12">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center mb-4"
              style={{ background: "var(--bg-sunken)" }}
            >
              <span className="text-xl">🏢</span>
            </div>
            <p className="text-sm font-medium mb-1" style={{ color: "var(--text-primary)" }}>
              Company Room
            </p>
            <p className="text-xs text-center max-w-[240px]" style={{ color: "var(--text-tertiary)" }}>
              Multi-agent workspace. Use @agent to direct messages to specific agents.
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3 justify-center max-w-[300px]">
              {agents.filter((a) => a.enabled !== false).map((agent) => {
                const colors = getAgentColor(agent.id);
                return (
                  <Badge key={agent.id} variant="outline">
                    <span
                      className="w-1.5 h-1.5 rounded-full inline-block mr-1"
                      style={{ background: colors.border }}
                    />
                    @{agent.id}
                  </Badge>
                );
              })}
            </div>
          </div>
        )}

        {messages.map((msg) => {
          const isUser = msg.role === "user";
          const agentColors = msg.agentId ? getAgentColor(msg.agentId) : null;

          return (
            <div key={msg.id} className={`flex ${isUser ? "justify-end" : "justify-start"} mb-3`}>
              <div className="max-w-[80%]">
                {/* Agent name + avatar */}
                {!isUser && msg.agentName && (
                  <div className="flex items-center gap-1.5 mb-1 px-1">
                    {agentColors && (
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold"
                        style={{ background: agentColors.bg, color: agentColors.text }}
                      >
                        {msg.agentName.charAt(0)}
                      </div>
                    )}
                    <span className="text-[11px] font-medium" style={{ color: agentColors?.text || "var(--text-tertiary)" }}>
                      {msg.agentName}
                    </span>
                  </div>
                )}

                {/* Message bubble */}
                <div
                  className={`px-4 py-2.5 rounded-2xl text-[13px] leading-relaxed ${isUser ? "font-medium" : ""}`}
                  style={{
                    background: isUser
                      ? "var(--accent-light)"
                      : agentColors?.bg || "var(--bg-sunken)",
                    color: isUser
                      ? "var(--accent-hover)"
                      : agentColors?.text || "var(--text-primary)",
                    borderBottomRightRadius: isUser ? "6px" : undefined,
                    borderBottomLeftRadius: !isUser ? "6px" : undefined,
                    border: isUser ? "1px solid var(--accent-muted)" : undefined,
                  }}
                >
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>

                {/* Timestamp */}
                <p
                  className="text-[11px] mt-1.5 px-1"
                  style={{
                    color: "var(--text-tertiary)",
                    textAlign: isUser ? "right" : "left",
                  }}
                >
                  {formatTime(msg.timestamp)}
                </p>
              </div>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start mb-3">
            <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl" style={{ background: "var(--bg-sunken)", borderBottomLeftRadius: "6px" }}>
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "-0.3s" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)", animationDelay: "-0.15s" }} />
              <span className="w-1.5 h-1.5 rounded-full animate-bounce" style={{ background: "var(--text-tertiary)" }} />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Composer with @mention support */}
      <div
        className="px-6 py-4 shrink-0 relative"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        {/* @mention dropdown */}
        {showMentions && filteredAgents.length > 0 && (
          <div
            className="absolute bottom-full left-6 right-6 mb-2 rounded-lg border overflow-hidden z-10"
            style={{ background: "var(--bg-card)", borderColor: "var(--border)" }}
          >
            {filteredAgents.slice(0, 6).map((agent) => {
              const colors = getAgentColor(agent.id);
              return (
                <button
                  key={agent.id}
                  onClick={() => selectMention(agent)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm hover:opacity-80 transition-opacity"
                  style={{ color: "var(--text-primary)" }}
                >
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold"
                    style={{ background: colors.bg, color: colors.text }}
                  >
                    {agent.name.charAt(0)}
                  </div>
                  <span className="font-medium">@{agent.id}</span>
                  <span className="text-xs" style={{ color: "var(--text-tertiary)" }}>
                    {agent.role}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        <div
          className="flex items-end gap-2 rounded-xl px-3 py-2 transition-all duration-200"
          style={{
            background: "var(--bg-sunken)",
            border: focused ? "1px solid var(--accent-muted)" : "1px solid var(--border)",
            boxShadow: focused ? "0 0 0 3px rgba(37, 99, 235, 0.08)" : "none",
          }}
        >
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder="Message the room... Use @agent to target"
            rows={1}
            className="flex-1 resize-none bg-transparent text-sm py-1 focus:outline-none"
            style={{ color: "var(--text-primary)" }}
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || loading}
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors disabled:opacity-30"
            style={{
              background: input.trim() ? "var(--accent)" : "var(--border-subtle)",
              color: input.trim() ? "var(--text-inverse)" : "var(--text-tertiary)",
              cursor: input.trim() ? "pointer" : "default",
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 2L11 13" />
              <path d="M22 2L15 22L11 13L2 9L22 2Z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
